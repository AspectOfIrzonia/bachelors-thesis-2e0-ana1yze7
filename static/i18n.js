async function fetchAvailableLanguages() {
  const res = await fetch("/langs");
  return await res.json(); // [{ code: "en", label: "English" }, ...]
}

let currentTranslations = {}; // save translation

function applyTranslations(translations = currentTranslations) {
  if (!translations) return;

  // text
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (translations[key]) el.textContent = translations[key];
  });

  // Placeholder
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (translations[key]) el.setAttribute("placeholder", translations[key]);
  });
}

async function loadLanguage(lang) {
  const res = await fetch(`/static/lang/${lang}.json`);
  currentTranslations = await res.json();

  applyTranslations(currentTranslations);

  document.documentElement.lang = lang;
  localStorage.setItem("lang", lang);
}

document.addEventListener("DOMContentLoaded", async () => {
  const langSelector = document.getElementById("language-selector");
  const currentLang = localStorage.getItem("lang") || "en";

  const languages = await fetchAvailableLanguages();
  languages.forEach(lang => {
    const option = document.createElement("option");
    option.value = lang.code;
    option.textContent = lang.label;
    langSelector.appendChild(option);
  });

  langSelector.value = currentLang;
  await loadLanguage(currentLang);

  langSelector.addEventListener("change", e => {
    loadLanguage(e.target.value);
  });
});
