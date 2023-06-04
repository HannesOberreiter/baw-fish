export const getDistUrl = () => {
  const { origin } = window.location;
  const isGithub = origin.includes('github.io');
  const apiUrl = isGithub ? `${origin}/baw-fish-cell-yolo` : origin;
  return apiUrl;
};
