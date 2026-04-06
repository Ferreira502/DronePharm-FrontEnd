export async function loadRuntimeConfig() {
  const response = await fetch("/config");

  if (!response.ok) {
    throw new Error("Nao foi possivel carregar a configuracao da aplicacao.");
  }

  return response.json();
}
