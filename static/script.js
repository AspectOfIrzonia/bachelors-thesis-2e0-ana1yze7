// Theme
const themeSelector = document.getElementById("theme-selector");
const html = document.documentElement;

const applyTheme = (theme) => {
    html.classList.remove("light", "dark");
    let actualTheme = theme;
    if (theme === "system") {
        actualTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    html.classList.add(actualTheme);
    html.dataset.theme = theme;
};

themeSelector.value = html.dataset.theme || "system";

themeSelector.addEventListener("change", () => {
    const selected = themeSelector.value;
    localStorage.setItem("theme", selected);
    applyTheme(selected);
});
// ===========================================================================================================
// Tabs
const tabs = document.querySelectorAll(".tab");
const urlInput = document.getElementById("url-input");
const fileInput = document.getElementById("file-input");
const jsonInput = document.getElementById("json-input");
const methodInput = document.getElementById("method");

tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
        // Убираем активный класс со всех табов
        tabs.forEach((t) => t.classList.remove("active"));
        // Добавляем активный класс на текущий таб
        tab.classList.add("active");

        // По значению data-method показываем нужный блок и меняем метод
        if (tab.dataset.method === "url") {
            urlInput.classList.remove("hidden");
            fileInput.classList.add("hidden");
            jsonInput.classList.add("hidden");
            methodInput.value = "url";
        } else if (tab.dataset.method === "file") {
            urlInput.classList.add("hidden");
            fileInput.classList.remove("hidden");
            jsonInput.classList.add("hidden");
            methodInput.value = "file";
        } else if (tab.dataset.method === "json") {
            urlInput.classList.add("hidden");
            fileInput.classList.add("hidden");
            jsonInput.classList.remove("hidden");
            methodInput.value = "json";
        }
    });
});

// ===========================================================================================================
// Accordeon
document.querySelectorAll(".accordion-button").forEach(button => {
    button.addEventListener("click", () => {
        const expanded = button.getAttribute("aria-expanded") === "true";
        button.setAttribute("aria-expanded", String(!expanded));

        const content = button.nextElementSibling;
        content.classList.toggle("open");
    });
});

// ===========================================================================================================
// Submit
document.getElementById("analyze-form").addEventListener("submit", async e => {
    e.preventDefault();
    const form = e.target;
    const method = form.querySelector("#method").value; // 'url', 'file' или 'json'
    const formData = new FormData(form);
    const results = document.getElementById("results");
    results.classList.remove("hidden");
    let html = "";

    
    
        if (method === "json") {
            // Отправляем JSON-файл на /upload-json
            res = await fetch("/upload-json", {
                method: "POST",
                body: formData
            });
        } else {
            // Для url или file вызываем /analyze
            res = await fetch("/analyze", {
                method: "POST",
                body: formData
            });
        }
        data = await res.json();
        
        
    if (data.title || data.description) {
        html += `<h3 data-i18n="precheck_title">Pre-check:</h3>`;
        html += `<p><strong data-i18n="result_title">Title:</strong> ${data.title}</p>`;
        html += `<p><strong data-i18n="result_description">Description:</strong> ${data.description}</p>`;
    }
    if (data.error) {
        html += `<p style="color:red"><span data-i18n="result_error">Err</span>${data.error}</p>`;
    }

// ====== SEMANTIC CORE ======
// ===========================================================================================================
    if (data.checks && data.checks.semantic) {
        const sem = data.checks.semantic;
        html += `<h3 data-i18n="semantic_title">semantic_title</h3>`;

        if (sem.description) {
            html += `<p><span data-i18n="analyse_lang"></span> <strong>${sem.title}</strong>; <span data-i18n="keyword_count"></span> <span>${sem.description}</span></p>`;
        }

        if (sem.words && sem.words.length > 0) {
            html += `<details><summary style="font-size:1em; font-weight:bold;" data-i18n="semantic_keywords">semantic_keywords</summary><ul>`;
            sem.words.forEach(([word, count]) => {
                html += `<li>${word} — <strong>${count}</strong></li>`;
            });
            html += `</ul></details>`;
        } 
            else {
                html += `<p data-i18n="semantic_no_keywords">semantic_no_keywords</p>`;
            }

        if (sem.bigrams && sem.bigrams.length > 0) {
            html += `<details><summary style="font-size:1em; font-weight:bold;" data-i18n="semantic_bigrams">semantic_bigrams</summary><ul>`;
            sem.bigrams.forEach(([phrase, count]) => {
                html += `<li>${phrase} — <strong>${count}</strong></li>`;
            });
            html += `</ul></details>`;
        }
    }

    
    if (data.checks && data.checks["user-semantic"]) {
        const userSemantic = data.checks["user-semantic"];
        html += `<h3 data-i18n="semantic_user_title">semantic_user_title</h3>`;

    if (userSemantic.error_i18n) {
        html += `<p data-i18n="${userSemantic.error_i18n}">error</p>`;
    } 
        else {
            html += `
            <p>
                <strong data-i18n="semantic_match_count">semantic_match_count</strong> ${userSemantic.counts.matched} / ${userSemantic.counts.total}
                (${userSemantic.percent}%),
                <strong data-i18n="semantic_missing">semantic_missing</strong> ${userSemantic.counts.missing},
                <strong data-i18n="semantic_extra">semantic_extra</strong> ${userSemantic.counts.extra}
            </p>`;

            if (userSemantic.matched.length > 0) {
                html += `<details><summary style="font-size:1em; font-weight:bold;" data-i18n="semantic_match_list">semantic_match_list</summary><ul>`;
                userSemantic.matched.forEach(word => {
                    html += `<li>${word}</li>`;
                });
                html += `</ul></details>`;
            }

            if (userSemantic.missing.length > 0) {
                html += `<details><summary style="font-size:1em; font-weight:bold;" data-i18n="semantic_missing_list">semantic_missing_list</summary><ul>`;
                userSemantic.missing.forEach(word => {
                    html += `<li>${word}</li>`;
                });
                html += `</ul></details>`;
            }

            if (userSemantic.extra.length > 0) {
                html += `<details><summary style="font-size:1em; font-weight:bold;" data-i18n="semantic_extra_list">semantic_extra_list</summary><ul>`;
                userSemantic.extra.forEach(word => {
                    html += `<li>${word}</li>`;
                });
                html += `</ul></details>`;
            }
        }
    }

    
    if (data.checks && data.checks.metrics) {
        const metrics = data.checks.metrics;

        html += `<details><summary style="font-size:1em; font-weight:bold;" data-i18n="semantic_analysis">semantic_analysis</summary>`;
        html += `<table class="metrics-table">
            <thead>
                <tr>
                    <th data-i18n="word">word</th>
                    <th data-i18n="count">count</th>
                    <th data-i18n="density">density (%)</th>
                    <th data-i18n="nausea">nausea</th>
                    <th data-i18n="recommendation">recommendation</th>
                </tr>
            </thead>
        <tbody>`;

        metrics.keywords.forEach(k => {
            html += `<tr>
                <td>${k.word}</td>
                <td>${k.count}</td>
                <td>${k.density}%</td>
                <td>${k.nausea}</td>
                <td data-i18n="${k.recommendation_key}">${k.recommendation_key}</td>
            </tr>`;
        });

        html += `</tbody></table></details>`;


        html += `<p><strong data-i18n="overused_keywords">overused_keywords</strong> ${metrics.summary.overused}</p>`;
        html += `<p><strong data-i18n="underused_keywords">underused_keywords</strong> ${metrics.summary.underused}</p>`;
        
// Recomendation (General)   
        const maxKeywordsPercent = parseFloat(document.getElementById("max_words").value) || 20;
        const threshold = maxKeywordsPercent / 100*20;
        html += `<details><summary style="font-size:1em; font-weight:bold;" data-i18n="semantic_recommendations">semantic_recommendations</summary><ul>`;
        if (metrics.summary.overused > threshold) {
            html += `<li data-i18n="recommend_density_high">recommend_density_high</li>`;
        } 
            else if (metrics.summary.underused > threshold) {
                html += `<li data-i18n="recommend_density_low">recommend_density_low</li>`;
        } 
            else {
                html += `<li data-i18n="recommend_density_ok">recommend_density_ok</li>`;
        }
        
        const avg = parseFloat(metrics.summary.density_avg);
        html += `<p><strong data-i18n="average_density">average_density</strong> ${metrics.summary.density_avg}%</p>`;
            if (avg > 5) {
                html += `<li data-i18n="recommend_overused">recommend_overused</li>`;
            }
                else if (avg < 1) {
                    html += `<li data-i18n="recommend_underused">recommend_underused</li>`;
                }
                else {
                    html += `<li data-i18n="recommend_all_good">recommend_all_good</li>`;
                }

        html += `</ul></details>`;
    }
    
// ===========================================================================================================    
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    if (data.checks && data.checks.structure) {
        const struct = data.checks.structure;
        const details = data.checks.structure.error_details || {};

        html += `<h3 data-i18n="structure_title">structure_title</h3>`;

// === HEAD ===
        html += `<details><summary style="font-weight:bold;" data-i18n="structure_head">structure_head</summary><ul>`;

            html += `<li><span data-i18n="${struct.head.title ? 'structure_head_title_ok' : 'structure_head_title_missing'}">[structure_head_title]</span></li>`;
            html += `<li><span data-i18n="${struct.head.meta_description ? 'structure_head_description_ok' : 'structure_head_description_missing'}">[structure_head_description]</span></li>`;
            html += `<li><span data-i18n="${struct.head.meta_keywords ? 'structure_head_keywords_ok' : 'structure_head_keywords_missing'}">[structure_head_keywords]</span></li>`;
            html += `<li><span data-i18n="${struct.head.meta_robots ? 'structure_head_robots_ok' : 'structure_head_robots_missing'}">[structure_head_robots]</span></li>`;
            html += `<li><span data-i18n="${struct.head.canonical ? 'structure_head_canonical_ok' : 'structure_head_canonical_missing'}">[structure_head_canonical]</span></li>`;
        html += `</ul>`;

// Meta robots
        if (struct.head.checks) {
            html += `<span data-i18n="structure_head_robots_directives">Meta Robots directives</span><ul>`;
                html += `<li data-i18n="${struct.head.checks.noindex ? 'head_robots_noindex' : 'head_robots_no_noindex'}">[head_robots_noindex]</li>`;
                html += `<li data-i18n="${struct.head.checks.nofollow ? 'head_robots_nofollow' : 'head_robots_no_nofollow'}">[head_robots_nofollow]</li>`;
                html += `<li data-i18n="${struct.head.checks.noarchive ? 'head_robots_noarchive' : 'head_robots_no_noarchive'}">[head_robots_noarchive]</li>`;
                html += `<li data-i18n="${struct.head.checks.nosnippet ? 'head_robots_nosnippet' : 'head_robots_no_nosnippet'}">[head_robots_nosnippet]</li>`;
            html += `</ul>`;
        }

        html += `</details>`;

// === HEADINGS ===
        html += `<details><summary style="font-size:1em; font-weight:bold;" data-i18n="structure_headings">structure_headings</summary>  `;
        const hcounts = Object.entries(struct.headings.count).map(([tag, count]) => `${tag.toUpperCase()}: ${count}`).join(', ');
        html += `<ul><li><strong data-i18n="structure_headings_count">structure_headings_count</strong> ${hcounts}</li>`;

        html += ``;
        
// several h1
        if (struct.headings.multiple_h1 && struct.headings.multiple_h1_locations) {
            let errorText = '';
            struct.headings.multiple_h1_locations.forEach(loc => {
                errorText += `Line ${loc.line || '?'}:\n${loc.html_snippet.replace(/</g, '&lt;').replace(/>/g, '&gt;')}\n\n`;
            });
            html += `<details><summary data-i18n="${struct.headings.has_h1 ? (struct.headings.multiple_h1 ? 'structure_h1_multiple' : 'structure_h1_ok') : 'structure_h1_missing'}">[structure_h1_status]</summary>
            <textarea rows="10" class="input-small" style="width:100%; height:500px; resize: vertical; box-sizing: border-box;" readonly>${errorText}</textarea></details>`;
        }

// Bad hierarchy
        if (struct.headings.bad_hierarchy && struct.headings.bad_hierarchy_details) {
            let errorText = '';
            struct.headings.bad_hierarchy_details.forEach(item => {
                errorText += `Line ${item.line || '?'}: h${item.current_level} → h${item.next_level}\n${item.html_snippet.replace(/</g, '&lt;').replace(/>/g, '&gt;')}\n\n`;
            });
            html += `<details><summary data-i18n="${struct.headings.bad_hierarchy ? 'structure_hierarchy_bad' : 'structure_hierarchy_ok'}">[structure_hierarchy_status]</summary>
            <textarea rows="10" class="input-small" style="width:100%; height:500px; resize: vertical; box-sizing: border-box;" readonly>${errorText}</textarea></details>`;
        }
        html += `</ul></details>`;
    
// === SEMANTIC TAGS ===
        html += `<details><summary style="font-size:1em; font-weight:bold;" data-i18n="structure_semantics">structure_semantics</summary>`;

// Tag list & count
        html += `<ul>`;
        const semantics = struct.semantics || {};
        const semanticTagNames = ["main", "article", "section", "nav", "aside", "header", "footer"];
        let semanticTypesUsed = 0;

        semanticTagNames.forEach(tag => {
            const count = semantics[tag] || 0;
            if (count > 0) semanticTypesUsed++;
            html += `<li>&lt;${tag}&gt;: ${count}</li>`;
        });
        html += `</ul>`;

// Warnings
        html += `<ul>`;
        if ((semantics["main"] || 0) === 0) {
            html += `<li data-i18n="structure_semantics_main_missing">[structure_semantics_main_missing]</li>`;
        }
        if ((semantics["main"] || 0) > 1) {
            html += `<li data-i18n="structure_semantics_main_multiple">[structure_semantics_main_multiple]</li>`;
        }
        if ((semantics["header"] || 0) === 0) {
            html += `<li data-i18n="structure_semantics_header_missing">[structure_semantics_header_missing]</li>`;
        }
        if ((semantics["footer"] || 0) === 0) {
            html += `<li data-i18n="structure_semantics_footer_missing">[structure_semantics_footer_missing]</li>`;
        }
        if (semanticTypesUsed < 3) {
            html += `<li data-i18n="structure_semantics_too_few_semantic_tags">[structure_semantics_too_few_semantic_tags]</li>`;
        }
        if (semanticTypesUsed >= 3) {
            html += `<li data-i18n="structure_semantics_ok">[structure_semantics_ok]</li>`;
        }
        html += `</ul></details>`;
    
// === LINKS ===
        html += `<details><summary style="font-size:1em; font-weight:bold;" data-i18n="structure_links">structure_links</summary><ul>`;
            html += `<li><span data-i18n="structure_links_total">[structure_links_total]</span> <strong>${struct.links.total}</strong></li>`;
            html += `<li><span data-i18n="structure_links_href">[structure_links_href]</span> <strong>${struct.links.with_href}</strong></li>`;
            html += `<li><span data-i18n="structure_links_external">[structure_links_external]</span> <strong>${struct.links.external}</strong></li>`;
            html += `<li><span data-i18n="structure_links_nofollow">[structure_links_nofollow]</span> <strong>${struct.links.nofollow}</strong></li>`;
            html += `<li><span data-i18n="structure_links_anchorless">[structure_links_anchorless]</span> <strong>${struct.links.anchorless || 0}</strong></li>`;
        html += `</ul>`;

        html += `<ul>`;
        if ((struct.links.anchorless || 0) > struct.links.total * 0.05) {
            html += `<li><span data-i18n="structure_links_too_many_anchorless">[structure_links_too_many_anchorless]</span></li>`;
        }
        html += `</ul></details>`;
    
// === IMAGES ===
        html += `<details><summary style="font-size:1em; font-weight:bold;" data-i18n="structure_images">structure_images</summary><ul>`;
            html += `<li><span data-i18n="structure_images_total">[structure_images_total]</span> <strong>${struct.images.total}</strong></li>`;
            html += `<li><span data-i18n="structure_images_with_alt">[structure_images_with_alt]</span> <strong>${struct.images.with_alt}</strong></li>`;
            html += `<li><span data-i18n="structure_images_duplicate_alt">[structure_images_duplicate_alt]</span> <strong>${struct.images.duplicate_alt}</strong></li>`;
            html += `<li><span data-i18n="structure_images_formats">[structure_images_formats]</span> <strong>${(struct.images.modern_formats || []).join(', ') || '—'}</strong></li>`;
        html += `</ul>`;

        html += `<ul>`;
        
// === IMAGES ALT MISSING ===
        if (struct.images.with_alt < struct.images.total && details.images_alt_missing) {
            let errorText = '';
            details.images_alt_missing.forEach(item => {
                errorText += `Line ${item.line || '?'}:\n${escapeHtml(item.html_snippet)}\n\n`;
            });
            html += `<li><details><summary><span data-i18n="${struct.images.with_alt < struct.images.total ? 'structure_images_alt_missing' : 'structure_images_alt_ok'}">[structure_images_alt_status]</span></summary>
            <textarea rows="10" class="input-small" style="width:100%; height:500px; resize: vertical; box-sizing: border-box;" readonly>${errorText}</textarea></details></li>`;
        }

        html += ``;
        
// === IMAGES ALT DUPLICATES ===
        if (struct.images.duplicate_alt > 0 && details.images_alt_duplicates) {
            let errorText = '';
            details.images_alt_duplicates.forEach(item => {
                errorText += `Line ${item.line || '?'}:\n${escapeHtml(item.html_snippet)}\n\n`;
            });
            html += `<li><details><summary><span data-i18n="${struct.images.duplicate_alt > 0 ? 'structure_images_alt_duplicates' : 'structure_images_alt_unique'}">[structure_images_alt_duplicates_status]</span></summary>
            <textarea rows="10" class="input-small" style="width:100%; height:500px; resize: vertical; box-sizing: border-box;" readonly>${errorText}</textarea></details></li>`;
        }

        html += `<li><span data-i18n="${(struct.images.modern_formats || []).length > 0 ? 'structure_images_modern_ok' : 'structure_images_modern_missing'}">[structure_images_modern_status]</span></li>`;
        html += `</ul></details>`;
        
// === WARNINGS ===
        html += `<details><summary style="font-size:1em; font-weight:bold;" data-i18n="structure_warnings">[structure_warnings]</summary><ul>`;
// Duplicate ids
        if (struct.errors.includes('duplicate_ids') && details.duplicate_ids) {
            let errorText = '';
            details.duplicate_ids.forEach(item => {
                errorText += `Line ${item.line || '?'}:\n${escapeHtml(item.html_snippet)}\n\n`;
            });
            html += `<li><details><summary data-i18n="structure_error_duplicate_ids">⚠️ DUPLICATE IDS:</summary>
            <textarea rows="10" class="input-small" style="width:100%; height:500px; resize: vertical; box-sizing: border-box;" readonly>${errorText}</textarea></details></li>`;
        }

// Forbiden nesting
        if (struct.errors.includes('forbidden_nesting') && details.forbidden_nesting) {
            let errorText = '';
            details.forbidden_nesting.forEach(item => {
                errorText += `Line ${item.line || '?'}:\n${escapeHtml(item.html_snippet)}\n\n`;
            });
            html += `<li><details><summary data-i18n="structure_error_forbidden_nesting">⚠️ FORBIDDEN NESTING:</summary>
            <textarea rows="10" class="input-small" style="width:100%; height:500px; resize: vertical; box-sizing: border-box;" readonly>${errorText}</textarea></details></li>`;
        }
        html += `</ul></details>`;
    }


// ===========================================================================================================
// === CONTENT ORDER ===
    
    if (data.content_order) {
        const co = data.content_order;
        html += `<details><summary style="font-size:1em; font-weight:bold;" data-i18n="structure_content_order">Content Order</summary><ul>`;

        // H1
        html += `<li>`;
        html += `<span data-i18n="${co.h1_found ? 'content_order_h1_ok' : 'content_order_h1_missing'}"></span>`;
        if (co.h1_found) html += ` <span><span data-i18n="position_prefix">Position:</span> ${co.h1_position}</span>`;
        html += `</li>`;

        // Text
        html += `<li>`;
        html += `<span data-i18n="${co.text_found ? 'content_order_text_ok' : 'content_order_text_missing'}"></span>`;
        if (co.text_found) html += ` <span><span data-i18n="position_prefix">Position:</span> ${co.text_position}</span>`;
        html += `</li>`;

        // Image
        html += `<li>`;
        html += `<span data-i18n="${co.image_found ? 'content_order_image_ok' : 'content_order_image_missing'}"></span>`;
        if (co.image_found) html += ` <span><span data-i18n="position_prefix">Position:</span> ${co.image_position}</span>`;
        html += `</li>`;

        // Script
        html += `<li>`;
        html += `<span data-i18n="${co.script_before_content ? 'content_order_script_bad' : 'content_order_script_ok'}"></span>`;
        html += ` <span>`;
        if (co.script_position !== null) {
            html += `<span data-i18n="position_prefix">Position:</span> ${co.script_position}`;
        } else {
            html += `<span data-i18n="position_unknown">Position unknown</span>`;
        }
        html += `</span></li>`;

        html += `</ul></details>`;
    }


    if (data.above_the_fold) {
        const atf = data.above_the_fold;
        html += `<details><summary style="font-size:1em; font-weight:bold;" data-i18n="above_the_fold_title">Above the Fold</summary><ul>`;
            html += `<li data-i18n="${atf.has_h1 ? 'above_the_fold_h1_ok' : 'above_the_fold_h1_missing'}">[above_the_fold_h1]</li>`;
            html += `<li data-i18n="${atf.has_text ? 'above_the_fold_text_ok' : 'above_the_fold_text_missing'}">[above_the_fold_text]</li>`;
            html += `<li data-i18n="${atf.has_image ? 'above_the_fold_image_ok' : 'above_the_fold_image_missing'}">[above_the_fold_image]</li>`;
            // number count
            html += `<li><strong data-i18n="above_the_fold_line_count_label">Lines checked:</strong> ${atf.line_count}</li>`;
            html += `<li><strong data-i18n="above_the_fold_text_length_label">Text length:</strong> ${atf.text_length}</li>`;
            html += `<li><strong data-i18n="above_the_fold_image_count_label">Images count:</strong> ${atf.image_count}</li>`;
        html += `</ul></details>`;
    }


    if (data.checks && data.checks.illegal_techniques) {
        const illegal = data.checks.illegal_techniques;
        html += `<h3 data-i18n="illegal_techniques_title">illegal_techniques_title</h3><ul>`;
            // 1. Meta refresh redirect
            html += `<li data-i18n="${illegal.meta_refresh_redirect ? 'illegal_meta_refresh_found' : 'illegal_meta_refresh_ok'}">[illegal_meta_refresh]</li>`;
            // 2. JS redirect
            html += `<li data-i18n="${illegal.js_redirect ? 'illegal_js_redirect_found' : 'illegal_js_redirect_ok'}">[illegal_js_redirect]</li>`;
            // 3. Hidden text
            html += `<li data-i18n="${illegal.hidden_text ? 'illegal_hidden_text_found' : 'illegal_hidden_text_ok'}">[illegal_hidden_text]</li>`;
            // 4. Hidden form fields
            html += `<li data-i18n="${illegal.hidden_form_fields ? 'illegal_hidden_form_found' : 'illegal_hidden_form_ok'}">[illegal_hidden_form]</li>`;
            // 5. Hidden forms without submit
            html += `<li data-i18n="${illegal.hidden_forms_without_submit.length > 0 ? 'illegal_form_without_submit_found' : 'illegal_form_without_submit_ok'}">[illegal_form_without_submit]</li></ul>`;

        // details: textarea
        if (illegal.hidden_forms_without_submit.length > 0) {
            let hiddenFormsText = '';
            illegal.hidden_forms_without_submit.forEach((formHtml, index) => {
                const escaped = formHtml.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                hiddenFormsText += `#${index + 1}:\n${escaped}\n\n`;
            });
            html += `<details open><summary style="font-weight:bold;" data-i18n="illegal_form_without_submit_list">[illegal_form_without_submit_list]</summary>`;
            html += `<textarea rows="10" class="input-small" style="width:100%; height:500px; resize: vertical; box-sizing: border-box;" readonly>${hiddenFormsText}</textarea></details>`;
        }
    }
    
    
    if (data.checks && data.checks.mobile_adaptivity) {
        const adapt = data.checks.mobile_adaptivity;
        html += `<details open><summary style="font-size:1em; font-weight:bold;" data-i18n="structure_mobile_adaptivity">structure_mobile_adaptivity</summary><ul>`;
            html += `<li data-i18n="${adapt.has_viewport_meta ? 'mobile_viewport_ok' : 'mobile_viewport_missing'}">[mobile_viewport]</li>`;
            html += `<li data-i18n="${adapt.has_media_queries ? 'mobile_media_ok' : 'mobile_media_missing'}">[mobile_media]</li>`;
            html += `<li data-i18n="${adapt.has_fixed_width ? 'mobile_fixed_width_bad' : 'mobile_fixed_width_ok'}">[mobile_fixed_width]</li>`;
            html += `<li data-i18n="${adapt.has_small_font ? 'mobile_font_size_bad' : 'mobile_font_size_ok'}">[mobile_font_size]</li>`;
            html += `<li data-i18n="${adapt.has_horizontal_scroll_risk ? 'mobile_scroll_bad' : 'mobile_scroll_ok'}">[mobile_scroll]</li>`;
        html += `</ul></details>`;
    }
    
// =========================================================================================================== 
    if (data.checks && data.checks.performance) {
        const perf = data.checks.performance;
        function getRating(value, thresholds) {
            if (value === null || value === undefined) return 'performance_rating_no_data';
            if (value < thresholds.good) return 'performance_rating_good';
            if (value <= thresholds.improve) return 'performance_rating_improve';
            return 'performance_rating_bad';
        }
        html += `<details open><summary style="font-size:1em; font-weight:bold;" data-i18n="performance_title">performance_title</summary><ul>`;
        // TTFB (секунды)
            html += `<li><span data-i18n="performance_ttfb">TTFB: </span><strong>${perf.ttfb !== null ? perf.ttfb.toFixed(3) + ' sec' : 'no data'}</strong> — <span data-i18n="${getRating(perf.ttfb * 1000, {good: 500, improve: 800})}">performance_rating_no_data</span></li>`;
        // load time (Seconds)
            html += `<li><span data-i18n="performance_load_time">performance_load_time</span><strong>${perf.load_time !== null ? perf.load_time.toFixed(3) + ' sec' : 'no data'}</strong> — <span data-i18n="${getRating(perf.load_time, {good: 2, improve: 4})}">performance_rating_no_data</span></li>`;
        // page size (kb)
            const pageSizeMb = perf.page_size_kb !== null ? perf.page_size_kb / 1024 : null;
            html += `<li><span data-i18n="performance_page_size">performance_page_size</span><strong>${perf.page_size_kb !== null ? perf.page_size_kb.toFixed(2) + ' KB' : 'no data'}</strong> — <span data-i18n="${getRating(pageSizeMb, {good: 2, improve: 4})}">performance_rating_no_data</span></li>`;
        // request amount
            html += `<li><span data-i18n="performance_request_count">performance_request_count</span><strong>${perf.request_count}</strong> — <span data-i18n="${getRating(perf.request_count, {good: 50, improve: 100})}">performance_rating_no_data</span></li>`;
        // resource size (kb)
            const resSizeMb = perf.resource_size_kb !== null ? perf.resource_size_kb / 1024 : null;
            html += `<li><span data-i18n="performance_resource_size">performance_resource_size</span><strong>${perf.resource_size_kb !== null ? perf.resource_size_kb.toFixed(2) + ' KB' : 'no data'}</strong> — <span data-i18n="${getRating(resSizeMb, {good: 2, improve: 4})}">performance_rating_no_data</span></li>`;
        html += `</ul></details>`;
}
    
// ===========================================================================================================    
    if (data.checks && data.checks.api_data) {
        const api = data.checks.api_data;
        const metrics = api.metrics || {};
        html += `<details open><summary style="font-size:1em; font-weight:bold;" data-i18n="pagespeed_title">PageSpeed Insights (${api.strategy})</summary><ul>`;
        // Performance score (general mark)
            html += `<li><span data-i18n="pagespeed_performance_score">Performance score: </span><strong>${api.performance_score !== null ? api.performance_score : 'нет данных'}</strong></li>`;
        // Metrics with display_value and score
        const keys = [
            { key: 'first-contentful-paint', label: 'pagespeed_fcp' },
            { key: 'speed-index', label: 'pagespeed_speed_index' },
            { key: 'largest-contentful-paint', label: 'pagespeed_lcp' },
            { key: 'interactive', label: 'pagespeed_interactive' },
            { key: 'total-blocking-time', label: 'pagespeed_tbt' },
            { key: 'cumulative-layout-shift', label: 'pagespeed_cls' }
        ];

        keys.forEach(({ key, label }) => {
            if (metrics[key]) {
                const val = metrics[key].display_value || 'no data';
                const score = metrics[key].score;
                let scoreClass = '';
                if (score !== null && score !== undefined) {
                    if (score >= 0.9) scoreClass = 'score-good';
                        else if (score >= 0.5) scoreClass = 'score-average';
                        else scoreClass = 'score-bad';
                }
                html += `<li><span data-i18n="${label}">${label.replace('pagespeed_', '').toUpperCase()}: </span><strong>${val}</strong> <span class="${scoreClass}">(${(score !== null ? (score * 100).toFixed(0) : '?')}%)</span></li>`;
            }
        });
        html += `</ul></details>`;
    }

// ===========================================================================================================    
    results.innerHTML = html; 
    
    // re-translate
    if (typeof applyTranslations === "function") {
        applyTranslations();  // <-- вызов из i18n.js
    }
});

// ===========================================================================================================
document.addEventListener("DOMContentLoaded", () => {
    //semantic
    const semanticCheckbox = document.querySelector('input[name="checks"][value="semantic"]');
    const userSemanticCheckbox = document.querySelector('input[name="checks"][value="user-semantic"]');
    const userKeywordsInput = document.getElementById("user-keywords-input");
    const semanticSettings = document.getElementById("semantic-settings");

    function updateUserSemanticState() {
        const semanticEnabled = semanticCheckbox.checked;
        userSemanticCheckbox.disabled = !semanticEnabled;

        if (!semanticEnabled) {
            userSemanticCheckbox.checked = false;
            userKeywordsInput.classList.add("hidden");
        } 
            else {
                if (userSemanticCheckbox.checked) {
                userKeywordsInput.classList.remove("hidden");
                }
            }
            if (semanticSettings) {
                semanticSettings.classList.toggle("hidden", !semanticEnabled);
            }
    }

    function toggleUserKeywordsInput() {
        if (userSemanticCheckbox.checked && !userSemanticCheckbox.disabled) {
            userKeywordsInput.classList.remove("hidden");
        } 
            else {
                userKeywordsInput.classList.add("hidden");
            }
    }

    //pagespeed_insights
    const pagespeedCheckbox = document.querySelector('input[name="checks"][value="pagespeed_insights"]');
    const pagespeedSettings = document.getElementById("pagespeed-settings");

    function updatePagespeedState() {
        if (pagespeedCheckbox.checked) {
            pagespeedSettings.classList.remove("hidden");
        } 
            else {
                pagespeedSettings.classList.add("hidden");
            }
    }

  // EventListener
    semanticCheckbox.addEventListener("change", updateUserSemanticState);
    userSemanticCheckbox.addEventListener("change", toggleUserKeywordsInput);

    if (pagespeedCheckbox && pagespeedSettings) {
        pagespeedCheckbox.addEventListener("change", updatePagespeedState);
        updatePagespeedState(); // start-up initilization
    }
    // SemanticState
    updateUserSemanticState();
});

// ===========================================================================================================


document.getElementById("download-json").addEventListener("click", function () {
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "seo_analysis.json";
    a.click();

    URL.revokeObjectURL(url);
});
