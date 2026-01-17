package helm

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"

	"helm.sh/helm/v3/pkg/chart"
	"helm.sh/helm/v3/pkg/chart/loader"
	"helm.sh/helm/v3/pkg/cli"
	"helm.sh/helm/v3/pkg/downloader"
	"helm.sh/helm/v3/pkg/getter"
	"helm.sh/helm/v3/pkg/registry"
	"helm.sh/helm/v3/pkg/repo"
	"sigs.k8s.io/yaml"
)

type RepoChartInfo struct {
	Name     string   `json:"name"`
	Versions []string `json:"versions"`
	Latest   string   `json:"latest"`
}

type RepoIndexResponse struct {
	Charts []RepoChartInfo `json:"charts"`
}

type RepoValuesResponse struct {
	Chart      string `json:"chart"`
	Version    string `json:"version"`
	ValuesYaml string `json:"valuesYaml"`
}

func fetchRepoIndex(repoURL string) (*repo.IndexFile, error) {
	if strings.HasPrefix(repoURL, "oci://") {
		return nil, fmt.Errorf("oci registries do not expose index.yaml")
	}
	indexURL := strings.TrimRight(repoURL, "/") + "/index.yaml"
	resp, err := http.Get(indexURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("repo index request failed: %s", resp.Status)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	index := repo.NewIndexFile()
	if err := yaml.Unmarshal(data, index); err != nil {
		return nil, err
	}
	index.SortEntries()
	return index, nil
}

func buildRepoIndexResponse(index *repo.IndexFile) RepoIndexResponse {
	charts := make([]RepoChartInfo, 0, len(index.Entries))
	for name, versions := range index.Entries {
		versionList := make([]string, 0, len(versions))
		for _, v := range versions {
			versionList = append(versionList, v.Version)
		}
		latest := ""
		if len(versionList) > 0 {
			latest = versionList[0]
		}
		charts = append(charts, RepoChartInfo{
			Name:     name,
			Versions: versionList,
			Latest:   latest,
		})
	}
	return RepoIndexResponse{Charts: charts}
}

func resolveChartURL(repoURL string, chartURL string) (string, error) {
	parsedBase, err := url.Parse(repoURL)
	if err != nil {
		return "", err
	}
	parsedChart, err := url.Parse(chartURL)
	if err != nil {
		return "", err
	}
	return parsedBase.ResolveReference(parsedChart).String(), nil
}

func hasOCITag(chartURL string) bool {
	lastSlash := strings.LastIndex(chartURL, "/")
	lastColon := strings.LastIndex(chartURL, ":")
	return lastColon > lastSlash
}

func resolveOCIVersion(version string, fallback string, chartURL string) string {
	if hasOCITag(chartURL) {
		return ""
	}
	if version != "" {
		return version
	}
	return fallback
}

func locateOCIChart(chartRef string, version string) (*chart.Chart, error) {
	settings := cli.New()
	registryClient, err := registry.NewClient()
	if err != nil {
		return nil, err
	}
	chartDownloader := downloader.ChartDownloader{
		Out:              io.Discard,
		Getters:          getter.All(settings),
		RegistryClient:   registryClient,
		RepositoryConfig: settings.RepositoryConfig,
		RepositoryCache:  settings.RepositoryCache,
		Options: []getter.Option{
			getter.WithRegistryClient(registryClient),
		},
	}
	tempDir, err := os.MkdirTemp("", "helm-oci-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tempDir)
	chartPath, _, err := chartDownloader.DownloadTo(chartRef, version, tempDir)
	if err != nil {
		return nil, err
	}
	return loader.Load(chartPath)
}

func fetchChartValues(repoURL, chartName, version string) (RepoValuesResponse, error) {
	index, err := fetchRepoIndex(repoURL)
	if err != nil {
		return RepoValuesResponse{}, err
	}
	entries := index.Entries[chartName]
	if len(entries) == 0 {
		return RepoValuesResponse{}, fmt.Errorf("chart not found")
	}

	var selected *repo.ChartVersion
	if version == "" {
		selected = entries[0]
	} else {
		for _, entry := range entries {
			if entry.Version == version {
				selected = entry
				break
			}
		}
		if selected == nil {
			return RepoValuesResponse{}, fmt.Errorf("version not found")
		}
	}

	if len(selected.URLs) == 0 {
		return RepoValuesResponse{}, fmt.Errorf("chart URL missing")
	}

	chartURL, err := resolveChartURL(repoURL, selected.URLs[0])
	if err != nil {
		return RepoValuesResponse{}, err
	}

	if strings.HasPrefix(chartURL, "oci://") {
		ociVersion := resolveOCIVersion(version, selected.Version, chartURL)
		chart, err := locateOCIChart(chartURL, ociVersion)
		if err != nil {
			return RepoValuesResponse{}, err
		}
		valuesYaml, err := yaml.Marshal(chart.Values)
		if err != nil {
			return RepoValuesResponse{}, err
		}
		return RepoValuesResponse{
			Chart:      chartName,
			Version:    selected.Version,
			ValuesYaml: string(valuesYaml),
		}, nil
	}

	resp, err := http.Get(chartURL)
	if err != nil {
		return RepoValuesResponse{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return RepoValuesResponse{}, fmt.Errorf("chart download failed: %s", resp.Status)
	}

	chartData, err := io.ReadAll(resp.Body)
	if err != nil {
		return RepoValuesResponse{}, err
	}

	chart, err := loader.LoadArchive(bytes.NewReader(chartData))
	if err != nil {
		return RepoValuesResponse{}, err
	}

	valuesYaml, err := yaml.Marshal(chart.Values)
	if err != nil {
		return RepoValuesResponse{}, err
	}

	return RepoValuesResponse{
		Chart:      chartName,
		Version:    selected.Version,
		ValuesYaml: string(valuesYaml),
	}, nil
}
