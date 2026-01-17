package helm

import (
	"bytes"
	"fmt"
	"log"
	"os"
	"strings"

	"helm.sh/helm/v3/pkg/action"
	"helm.sh/helm/v3/pkg/chart/loader"
	"helm.sh/helm/v3/pkg/cli"
	"helm.sh/helm/v3/pkg/registry"
	"helm.sh/helm/v3/pkg/release"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/discovery/cached/memory"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/restmapper"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
)

// HelmManager handles Helm operations
type HelmManager struct {
	settings *cli.EnvSettings
	config   *rest.Config
}

func NewHelmManager(config *rest.Config) *HelmManager {
	return &HelmManager{
		settings: cli.New(),
		config:   config,
	}
}

// getActionConfig returns a new action.Configuration for the given namespace
func (m *HelmManager) getActionConfig(namespace string) (*action.Configuration, error) {
	actionConfig := new(action.Configuration)
	
	clientGetter := &simpleRESTClientGetter{
		config:    m.config,
		namespace: namespace,
	}

	if err := actionConfig.Init(clientGetter, namespace, os.Getenv("HELM_DRIVER"), log.Printf); err != nil {
		return nil, err
	}

	return actionConfig, nil
}

// ListReleases lists all releases in a namespace
func (m *HelmManager) ListReleases(namespace string) ([]*release.Release, error) {
	cfg, err := m.getActionConfig(namespace)
	if err != nil {
		return nil, err
	}

	client := action.NewList(cfg)
	client.All = true
	client.StateMask = action.ListAll
	
	return client.Run()
}

// GetRelease returns a specific release
func (m *HelmManager) GetRelease(namespace, name string) (*release.Release, error) {
	cfg, err := m.getActionConfig(namespace)
	if err != nil {
		return nil, err
	}

	client := action.NewGet(cfg)
	return client.Run(name)
}

// GetValues returns values for a release
func (m *HelmManager) GetValues(namespace, name string, all bool) (map[string]interface{}, error) {
	cfg, err := m.getActionConfig(namespace)
	if err != nil {
		return nil, err
	}

	client := action.NewGetValues(cfg)
	client.AllValues = all
	return client.Run(name)
}

// GetHistory returns history for a release
func (m *HelmManager) GetHistory(namespace, name string) ([]*release.Release, error) {
	cfg, err := m.getActionConfig(namespace)
	if err != nil {
		return nil, err
	}

	client := action.NewHistory(cfg)
	return client.Run(name)
}

// Rollback rolls back a release to a specific revision
func (m *HelmManager) Rollback(namespace, name string, revision int) error {
	cfg, err := m.getActionConfig(namespace)
	if err != nil {
		return err
	}

	client := action.NewRollback(cfg)
	client.Version = revision
	return client.Run(name)
}

// Upgrade upgrades a release using existing chart but new values
func (m *HelmManager) Upgrade(namespace, name string, values map[string]interface{}) (*release.Release, error) {
	cfg, err := m.getActionConfig(namespace)
	if err != nil {
		return nil, err
	}

	// 1. Get the current release to access the chart
	histClient := action.NewHistory(cfg)
	histClient.Max = 1
	releases, err := histClient.Run(name)
	if err != nil || len(releases) == 0 {
		return nil, fmt.Errorf("release not found")
	}
	
	lastRelease := releases[0]
	chart := lastRelease.Chart
	if chart == nil {
		return nil, fmt.Errorf("chart not found in release")
	}

	// 2. Perform upgrade
	client := action.NewUpgrade(cfg)
	client.Namespace = namespace
	client.ReuseValues = false // We want to override with provided values
	
	return client.Run(name, chart, values)
}

// InstallFromRepo installs a chart from a repository URL.
func (m *HelmManager) InstallFromRepo(namespace, releaseName, repoURL, chartName, version string, values map[string]interface{}) (*release.Release, error) {
	cfg, err := m.getActionConfig(namespace)
	if err != nil {
		return nil, err
	}

	client := action.NewInstall(cfg)
	client.Namespace = namespace
	client.ReleaseName = releaseName
	client.ChartPathOptions.Version = version
	registryClient, err := registry.NewClient()
	if err != nil {
		return nil, err
	}
	client.SetRegistryClient(registryClient)

	chartRef := chartName
	if strings.HasPrefix(repoURL, "oci://") {
		chartRef = strings.TrimRight(repoURL, "/")
		if chartName != "" {
			chartRef = chartRef + "/" + chartName
		}
	} else {
		client.ChartPathOptions.RepoURL = repoURL
	}

	chartPath, err := client.ChartPathOptions.LocateChart(chartRef, m.settings)
	if err != nil {
		return nil, err
	}

	chart, err := loader.Load(chartPath)
	if err != nil {
		return nil, err
	}

	if values == nil {
		values = map[string]interface{}{}
	}

	return client.Run(chart, values)
}

// InstallFromArchive installs a chart from a .tgz archive.
func (m *HelmManager) InstallFromArchive(namespace, releaseName string, chartData []byte, values map[string]interface{}) (*release.Release, error) {
	cfg, err := m.getActionConfig(namespace)
	if err != nil {
		return nil, err
	}

	client := action.NewInstall(cfg)
	client.Namespace = namespace
	client.ReleaseName = releaseName

	chart, err := loader.LoadArchive(bytes.NewReader(chartData))
	if err != nil {
		return nil, err
	}

	if values == nil {
		values = map[string]interface{}{}
	}

	return client.Run(chart, values)
}


// simpleRESTClientGetter implements genericclioptions.RESTClientGetter
type simpleRESTClientGetter struct {
	config    *rest.Config
	namespace string
}

func (c *simpleRESTClientGetter) ToRESTConfig() (*rest.Config, error) {
	return c.config, nil
}

func (c *simpleRESTClientGetter) ToDiscoveryClient() (discovery.CachedDiscoveryInterface, error) {
	discoveryClient, err := discovery.NewDiscoveryClientForConfig(c.config)
	if err != nil {
		return nil, err
	}
	return memory.NewMemCacheClient(discoveryClient), nil
}

func (c *simpleRESTClientGetter) ToRESTMapper() (meta.RESTMapper, error) {
	discoveryClient, err := c.ToDiscoveryClient()
	if err != nil {
		return nil, err
	}

	mapper := restmapper.NewDeferredDiscoveryRESTMapper(discoveryClient)
	expander := restmapper.NewShortcutExpander(mapper, discoveryClient, nil)
	return expander, nil
}

func (c *simpleRESTClientGetter) ToRawKubeConfigLoader() clientcmd.ClientConfig {
	return &simpleClientConfig{config: c.config, namespace: c.namespace}
}

// simpleClientConfig implements clientcmd.ClientConfig
type simpleClientConfig struct {
	config    *rest.Config
	namespace string
}

func (c *simpleClientConfig) RawConfig() (clientcmdapi.Config, error) {
	return clientcmdapi.Config{}, fmt.Errorf("RawConfig not supported in simpleClientConfig")
}
func (c *simpleClientConfig) ClientConfig() (*rest.Config, error) {
	return c.config, nil
}
func (c *simpleClientConfig) Namespace() (string, bool, error) {
	return c.namespace, true, nil
}
func (c *simpleClientConfig) ConfigAccess() clientcmd.ConfigAccess {
	return nil
}
