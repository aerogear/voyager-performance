function customResolutionStrategy(serverState, clientState) {
  return {
    id: clientState.id,
    title: `updated after conflict. title: ${serverState.title}-${clientState.title}`
  };
}

module.exports = {
  customResolutionStrategy
};
