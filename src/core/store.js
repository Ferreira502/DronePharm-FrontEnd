export function createStore(initialState = {}) {
  const state = structuredClone(initialState);

  return {
    getState() {
      return state;
    },
    patch(partialState) {
      Object.assign(state, partialState);
      return state;
    },
  };
}
