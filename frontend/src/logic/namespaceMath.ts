
export const getNamespacePosition = (index: number, total: number) => {
  if (total === 0) return { x: 0, z: 0 };
  
  // Center the single namespace
  if (total === 1) return { x: 0, z: 0 };

  // Arrange namespaces in a circle
  const angle = (index / total) * Math.PI * 2;
  const radius = 35; // Much larger radius for clear separation
  return {
    x: Math.cos(angle) * radius,
    z: Math.sin(angle) * radius
  };
};

// Generate deterministic pastel color from string
export const getNamespaceColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return `hsl(${h}, 70%, 25%)`; // Dark saturated background color
};
