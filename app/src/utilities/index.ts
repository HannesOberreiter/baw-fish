export const getDistUrl = () => {
  const { origin } = window.location;
  const isGithub = origin.includes('github.io');
  const apiUrl = isGithub ? `${origin}/baw-fish` : origin;
  return apiUrl;
};
