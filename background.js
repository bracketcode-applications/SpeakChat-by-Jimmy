// Solo necesario si usas eventos persistentes
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extensión instalada');
});