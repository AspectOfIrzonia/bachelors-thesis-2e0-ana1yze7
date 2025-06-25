from flask import Flask, render_template, request, jsonify
from bs4 import BeautifulSoup, Tag,  NavigableString
import os
import zipfile
import re
import time
import requests
import json

import stanza
from itertools import islice
from collections import Counter
import stopwordsiso as stopwords
from langdetect import detect
from urllib.parse import urljoin, urlparse
from urllib.request import urlopen


app = Flask(__name__)

# ===============================================================================================
@app.route("/langs")
def get_languages():
    lang_dir = os.path.join(app.static_folder, "lang")
    langs = []
    for filename in os.listdir(lang_dir):
        if filename.endswith(".json"):
            code = filename[:-5]  # "en.json" → "en"
            # Try to read the language name from the file
            try:
                with open(os.path.join(lang_dir, filename), encoding='utf-8') as f:
                    data = json.load(f)
                    label = data.get("language_name", code.upper())
                    langs.append({"code": code, "label": label})
            except:
                langs.append({"code": code, "label": code.upper()})
    return jsonify(langs)

# ===============================================================================================
def extract_html(req, method):
    if method == "url":
        url = req.form.get("url")
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()  
            return response.text 
        except requests.exceptions.RequestException as e:
            raise ValueError(f"Error fetching URL: {e}")

    elif method == "file":
        file = req.files['file']
        if file.filename.endswith('.zip'):
            zip_path = os.path.join("uploads", file.filename)
            file.save(zip_path)
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall("uploads/temp")
                for name in zip_ref.namelist():
                    if name.endswith(".html"):
                        with open(os.path.join("uploads/temp", name), 'r', encoding='utf-8') as f:
                            return f.read()
        else:
            return file.read().decode('utf-8')

    return None

# ===============================================================================================
def precheck_module(html):
    soup = BeautifulSoup(html, 'html.parser')

    title = soup.title.string.strip() if soup.title else "No title"
    desc_tag = soup.find("meta", attrs={"name": "description"})
    description = desc_tag["content"].strip() if desc_tag else "No description"

    return {"title": title, "description": description}

# ===============================================================================================
loaded_pipelines = {}

#Getting stop words
def get_stopwords(lang):
    try:
        return set(stopwords.stopwords(lang))
    except:
        return set()

# Getting or downloading a Stanza model
def get_pipeline(lang):
    if lang not in loaded_pipelines:
        stanza.download(lang, verbose=False)
        try:
            pipeline = stanza.Pipeline(lang=lang, processors='tokenize,mwt,pos,lemma', use_gpu=False, verbose=False)
        except:
            pipeline = stanza.Pipeline(lang=lang, processors='tokenize,pos,lemma', use_gpu=False, verbose=False)
        loaded_pipelines[lang] = pipeline
    return loaded_pipelines[lang]

# Basic analysis function
def extract_semantics(html, max_words=20, max_bigrams=10, lang=None):
    soup = BeautifulSoup(html, "html.parser")
    elements = soup.find_all(["main", "article", "section", "p", "li", "h1", "h2", "h3", "h4", "h5", "h6"])
    text = " ".join(el.get_text(separator=" ", strip=True) for el in elements)

    #Clearing text
    text = text.lower()
    text = re.sub(r"[^a-zA-Zа-яА-ЯёЁіІїЇєЄ0-9\s]", " ", text)
    text = re.sub(r"\d+", "", text)
    text = re.sub(r"\s+", " ", text).strip()


    #Detect language if not specified
    try:
        lang = detect(text[:200])
    except:
        lang = "en"

    stop_words = get_stopwords(lang)

    try:
        nlp = get_pipeline(lang)
        doc = nlp(text)
    except Exception as e:
        return {
            "title": "",
            "description": "",
            "error": f"Ошибка при лемматизации: {str(e)}"
        }

    #Extraction of meaningful lemmas
    CONTENT_POS = {"NOUN", "PROPN", "VERB", "ADJ", "ADV"}
    lemmas = [
        word.lemma.lower()
        for sentence in doc.sentences
        for word in sentence.words
        if word.upos in CONTENT_POS and word.lemma.lower() not in stop_words and len(word.lemma) > 2
    ]

    #Frequency analysis
    word_freq = Counter(lemmas)
    most_common_words = word_freq.most_common(max_words)

    bigrams = zip(lemmas, islice(lemmas, 1, None))
    bigram_freq = Counter([" ".join(pair) for pair in bigrams])
    most_common_bigrams = bigram_freq.most_common(max_bigrams)

    return {
        "title": lang.upper(),
        "description": len(word_freq),
        "words": most_common_words,
        "bigrams": most_common_bigrams,
        "s-error": ""
    }

# ===============================================================================================
def compare_with_target_semantics(analysis_result, user_target_keywords):
    if not user_target_keywords:
        return {
            "matched": [],
            "missing": [],
            "extra": [],
            "percent": 0,
            "counts": {
                "matched": 0,
                "missing": 0,
                "extra": 0,
                "total": 0
            },
            "error_i18n": "semantic_target_not_set"
        }

    user_keywords = set(w.strip().lower() for w in user_target_keywords if len(w.strip()) > 1)

    found_words = set(w for w, _ in analysis_result.get("words", []))
    found_bigrams = set(b for b, _ in analysis_result.get("bigrams", []))

    matched = []
    missing = []

    for keyword in user_keywords:
        if ' ' in keyword:
            if keyword in found_bigrams:
                matched.append(keyword)
            else:
                missing.append(keyword)
        else:
            if keyword in found_words:
                matched.append(keyword)
            else:
                missing.append(keyword)

    extra_words = found_words - user_keywords
    extra_bigrams = found_bigrams - user_keywords

    extra = sorted(extra_words | extra_bigrams)

    total = len(user_keywords)
    percent = round(len(matched) / total * 100, 2) if total else 0

    return {
        "matched": sorted(matched),
        "missing": sorted(missing),
        "extra": extra,
        "percent": percent,
        "counts": {
            "matched": len(matched),
            "missing": len(missing),
            "extra": len(extra),
            "total": total
        },
        "error_i18n": ""
    }

# ===============================================================================================
def semantics_analys(semantic_result):
    words = semantic_result.get("words", [])
    total = sum(count for _, count in words)

    if total == 0:
        return {
            "keywords": [],
            "recommendations": [],
            "summary": {
                "density_avg": 0,
                "overused": 0,
                "underused": 0
            }
        }

    keywords = []
    overused = 0
    underused = 0

    for word, count in words:
        density = round((count / total) * 100, 2)  #%
        nausea = round(count ** 0.5, 2)            

        if density > 5:
            rec = "keyword_overused"
            overused += 1
        elif density < 1:
            rec = "keyword_underused"
            underused += 1
        else:
            rec = "keyword_ok"

        keywords.append({
            "word": word,
            "count": count,
            "density": density,
            "nausea": nausea,
            "recommendation_key": rec
        })

    density_avg = sum(k["density"] for k in keywords) / len(keywords), 2

    return {
        "keywords": keywords,
        "recommendations": list({k["recommendation_key"] for k in keywords}),
        "summary": {
            "density_avg": density_avg,
            "overused": overused,
            "underused": underused
        }
    }


# ===============================================================================================
def find_line_number(html, snippet):
    snippet = snippet.strip()
    index = html.find(snippet)
    if index == -1:
        return None

    preceding_text = html[:index]
    return preceding_text.count('\n') + 1


def analyze_html_structure(html):
    soup = BeautifulSoup(html, "html.parser")

    result = {
        "head": {},
        "head_recommendations": [],
        "headings": {},
        "semantics": {},
        "links": {},
        "images": {},
        "errors": [],
        "error_details": {}
    }

    # HEAD
    head = soup.head or soup.new_tag("head")
    title = head.title.string if head.title else ""
    result["head"]["title"] = bool(title and title.strip())

    meta_description = head.find("meta", attrs={"name": "description"})
    result["head"]["meta_description"] = meta_description is not None

    meta_keywords = head.find("meta", attrs={"name": "keywords"})
    result["head"]["meta_keywords"] = meta_keywords is not None

    meta_robots = head.find("meta", attrs={"name": "robots"})
    result["head"]["meta_robots"] = meta_robots is not None

    canonical = head.find("link", rel="canonical")
    result["head"]["canonical"] = canonical is not None

    # meta robots
    checks = {}
    if meta_robots:
        content = meta_robots.get("content", "").lower()
        checks["noindex"] = "noindex" in content
        checks["nofollow"] = "nofollow" in content
        checks["noarchive"] = "noarchive" in content
        checks["nosnippet"] = "nosnippet" in content
    else:
        checks["noindex"] = False
        checks["nofollow"] = False
        checks["noarchive"] = False
        checks["nosnippet"] = False

    result["head"]["checks"] = checks



    # HEADINGS
    heading_tags = soup.find_all(re.compile(r"h[1-6]"))
    headings = [tag.name for tag in heading_tags]
    h_count = Counter(headings)
    result["headings"]["count"] = dict(h_count)
    result["headings"]["has_h1"] = "h1" in h_count
    result["headings"]["multiple_h1"] = h_count.get("h1", 0) > 1

    # Let's find where exactly the multiples are h1
    if result["headings"]["multiple_h1"]:
        multiple_h1_locations = []
        for tag in heading_tags:
            if tag.name == "h1":
                snippet = str(tag)
                line = find_line_number(html, snippet)
                multiple_h1_locations.append({
                    "line": line,
                    "html_snippet": snippet
                })
        result["headings"]["multiple_h1_locations"] = multiple_h1_locations

    #Checking header hierarchy: if jump is greater than 1
    # === HEADINGS ===
    heading_tags = soup.find_all(re.compile(r"h[1-6]"))
    headings = [tag.name for tag in heading_tags]
    h_count = Counter(headings)

    result["headings"]["count"] = dict(h_count)
    result["headings"]["has_h1"] = "h1" in h_count
    result["headings"]["multiple_h1"] = h_count.get("h1", 0) > 1

    # If there are several h1 - add snippets
    if h_count.get("h1", 0) > 1:
        result["headings"]["multiple_h1_locations"] = []
        for tag in heading_tags:
            if tag.name == "h1":
                snippet = str(tag)
                line = find_line_number(html, snippet)
                result["headings"]["multiple_h1_locations"].append({
                    "html_snippet": snippet,
                    "line": line
                })

    #Check for bad hierarchy
    bad_hierarchy = False
    bad_details = []
    prev_level = None

    for tag in heading_tags:
        level = int(tag.name[1])
        snippet = str(tag)
        line = find_line_number(html, snippet)

        if prev_level is not None and level - prev_level > 1:
            bad_hierarchy = True
            bad_details.append({
                "current_level": prev_level,
                "next_level": level,
                "html_snippet": snippet,
                "line": line
            })

        prev_level = level

    result["headings"]["bad_hierarchy"] = bad_hierarchy
    result["headings"]["bad_hierarchy_details"] = bad_details

        
        # SEMANTICS
    semantic_tags = ["main", "article", "section", "nav", "aside", "header", "footer"]
    semantics_counts = {tag: len(soup.find_all(tag)) for tag in semantic_tags}
    result["semantics"] = semantics_counts

    # Semantic warnings
    warnings = []

    # 1. <main> is mandatory and must be one
    main_count = semantics_counts.get("main", 0)
    if main_count == 0:
        warnings.append("main_missing")
    elif main_count > 1:
        warnings.append("main_multiple")

    #2. Presence is desirable <header> и <footer>
    if semantics_counts.get("header", 0) == 0:
        warnings.append("header_missing")
    if semantics_counts.get("footer", 0) == 0:
        warnings.append("footer_missing")

    # 3.There must be at least 3 different semantic tags
    used_semantics = [tag for tag, count in semantics_counts.items() if count > 0]
    if len(used_semantics) < 3:
        warnings.append("too_few_semantic_tags")
    result["semantics_warnings"] = warnings

    # Examination main
    mains = soup.find_all('main')
    if len(mains) == 0:
        warnings.append("main_missing")
    elif len(mains) > 1:
        warnings.append("main_multiple")

    forbidden_parents_for_main = {'header', 'footer', 'article', 'aside'}
    for main in mains:
        parents = {parent.name for parent in main.parents if parent.name}
        if forbidden_parents_for_main.intersection(parents):
            warnings.append("main_wrong_parent")

    # Checking header/footer inside sections (article, section, nav, aside)
    section_tags = ['article', 'section', 'nav', 'aside']
    for sec_tag in section_tags:
        for section in soup.find_all(sec_tag):
            headers = section.find_all('header', recursive=False)
            footers = section.find_all('footer', recursive=False)
            if len(headers) > 1:
                warnings.append(f"multiple_header_in_{sec_tag}")
                #For more detail, you can add specific locations if needed.
            if len(footers) > 1:
                warnings.append(f"multiple_footer_in_{sec_tag}")

    result["semantics_warnings"] = warnings


    # === LINKS ===
    links = soup.find_all("a")
    result["links"]["total"] = len(links)
    result["links"]["with_href"] = sum(1 for a in links if a.get("href"))
    result["links"]["nofollow"] = sum(1 for a in links if "nofollow" in (a.get("rel") or []))
    result["links"]["external"] = sum(1 for a in links if a.get("target") == "_blank")
    result["links"]["no_anchor"] = sum(1 for a in links if not a.get_text(strip=True))

    # === IMAGES ===
    images = soup.find_all("img")
    alts = [img.get("alt", "").strip() for img in images]
    result["images"]["total"] = len(images)
    result["images"]["with_alt"] = sum(1 for alt in alts if alt)
    #Number of repeated alts, considering only non-empty alts
    alt_counts = Counter([alt for alt in alts if alt])
    result["images"]["duplicate_alt"] = sum(1 for count in alt_counts.values() if count > 1)
    #Modern formats are webp and svg
    modern_formats = [".webp", ".svg"]
    modern_used = set()
    for img in images:
        src = img.get("src", "").lower()
        for ext in modern_formats:
            if ext in src:
                modern_used.add(ext)
    result["images"]["modern_formats"] = list(modern_used) if modern_used else []

    #Errors for images
    if result["images"]["with_alt"] < result["images"]["total"]:
        result["errors"].append("images_alt_missing")
        #Let's add some details - for example, a list of images without alt and line numbers
        missing_alt_details = []
        for img in images:
            alt = img.get("alt", "").strip()
            if not alt:
                snippet = str(img)
                line = find_line_number(html, snippet)
                missing_alt_details.append({"html_snippet": snippet, "line": line})
        result["error_details"]["images_alt_missing"] = missing_alt_details

    if result["images"]["duplicate_alt"] > 0:
        result["errors"].append("images_alt_duplicates")
        #For details - which alt's are duplicated and where
        duplicate_alts = [alt for alt, count in alt_counts.items() if count > 1]
        duplicate_alt_details = []
        for alt_val in duplicate_alts:
            for img in images:
                alt = img.get("alt", "").strip()
                if alt == alt_val:
                    snippet = str(img)
                    line = find_line_number(html, snippet)
                    duplicate_alt_details.append({"alt": alt_val, "html_snippet": snippet, "line": line})
        result["error_details"]["images_alt_duplicates"] = duplicate_alt_details

    if not modern_used:
        result["errors"].append("images_modern_missing")

    # === STRUCTURE ERRORS ===

    # 1. Duplicate IDs
    id_elements = soup.find_all(attrs={"id": True})
    id_pattern = re.findall(r'id\s*=\s*["\']([^"\']+)["\']', html)
    id_counts = Counter(id_pattern)
    duplicate_ids = [id_ for id_, count in id_counts.items() if count > 1]

    if duplicate_ids:
        result["errors"].append("duplicate_ids")
        result["error_details"]["duplicate_ids"] = []

        # Let's find all occurrences of id="..." and strings
        for match in re.finditer(r'(<[^>]+?\s+id\s*=\s*["\'](?P<id>[^"\']+)["\'][^>]*>)', html):
            el_html = match.group(1)
            el_id = match.group('id')
            if el_id in duplicate_ids:
                line = find_line_number(html, el_html)
                result["error_details"]["duplicate_ids"].append({
                    "id": el_id,
                    "html_snippet": el_html,
                    "line": line
                })

    # 2. Forbidden nesting
    inline_tags = ['a', 'span', 'b', 'i', 'u', 'strong', 'em', 'small', 'abbr', 'cite', 'code', 'sub', 'sup', 'mark', 'q', 'time', 'var', 's', 'del', 'ins', 'kbd', 'samp', 'ruby', 'bdi', 'bdo', 'data', 'wbr']
    block_tags = ['div', 'section', 'article', 'header', 'footer', 'aside', 'nav', 'main', 'form', 'table', 'p', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'blockquote']

    forbidden = []
    for inline_tag in inline_tags:
        for el in soup.find_all(inline_tag):
            for block_tag in block_tags:
                if el.find(block_tag):
                    snippet = str(el)
                    line = find_line_number(html, snippet)
                    forbidden.append({
                        "inline_tag": inline_tag,
                        "block_tag": block_tag,
                        "html_snippet": snippet,
                        "line": line
                    })

    if forbidden:
        result["errors"].append("forbidden_nesting")
        result["error_details"]["forbidden_nesting"] = forbidden

    # 3. Deprecated tags
    deprecated_tags = ["center", "font", "marquee"]
    found_deprecated = []
    for tag in deprecated_tags:
        tags = soup.find_all(tag)
        for el in tags:
            snippet = str(el)
            line = find_line_number(html, snippet)
            found_deprecated.append({
                "tag": tag,
                "html_snippet": snippet,
                "line": line
            })
    if found_deprecated:
        result["errors"].append("deprecated_tags")
        result["error_details"]["deprecated_tags"] = found_deprecated

    # 4. CSS Checks
    css_text = html.lower()
    result["css"] = {
        "has_media_queries": "@media" in css_text,
        "has_flex": "display:flex" in css_text,
        "has_grid": "display:grid" in css_text
    }
    return result

# ===============================================================================================
def check_content_order(html):
    soup = BeautifulSoup(html, "html.parser")
    body = soup.body
    if not body:
        #If there is no buddy, we consider that the order is not observed.
        return {
            "h1_found": False,
            "h1_position": None,
            "text_found": False,
            "text_position": None,
            "image_found": False,
            "image_position": None,
            "script_found": False,
            "script_position": None,
            "script_before_content": False,
        }

    #Element appearance indices (tree order)
    h1_pos = None
    text_pos = None
    image_pos = None
    script_pos = None

    #Function to check if there is "meaningful" text
    def is_meaningful_text(s):
        if not s or not s.strip():
            return False
        text = s.strip()
        #Minimum characters to read as text
        return len(text) >= 30

    #Element traversal counter (node numbering in traversal order)
    pos_counter = 0

    script_before_content = False

    #We will go through the body and recursively search in the order of traversal
    def walk(node):
        nonlocal pos_counter, h1_pos, text_pos, image_pos, script_pos, script_before_content

        if isinstance(node, NavigableString):
            if text_pos is None and is_meaningful_text(node):
                text_pos = pos_counter
                #If the script was already before the text, we will note
                if script_pos is not None and script_pos < text_pos:
                    script_before_content = True
            pos_counter += 1
            return

        if not isinstance(node, Tag):
            return

        #Checking the tag
        tag_name = node.name.lower()

        if tag_name == "h1" and h1_pos is None:
            h1_pos = pos_counter
            if script_pos is not None and script_pos < h1_pos:
                script_before_content = True

        elif tag_name == "img" and image_pos is None:
            image_pos = pos_counter
            if script_pos is not None and script_pos < image_pos:
                script_before_content = True

        elif tag_name == "script" and script_pos is None:
            script_pos = pos_counter

        pos_counter += 1

        #Recursively go through the children (only if it is not a script, since the script does not contain content)
        if tag_name != "script":
            for child in node.children:
                walk(child)

    walk(body)

    return {
        "h1_found": h1_pos is not None,
        "h1_position": h1_pos,
        "text_found": text_pos is not None,
        "text_position": text_pos,
        "image_found": image_pos is not None,
        "image_position": image_pos,
        "script_found": script_pos is not None,
        "script_position": script_pos,
        "script_before_content": script_before_content
    }
# ===============================================================================================
def analyze_above_the_fold(html, line_limit=30):
    lines = html.splitlines()
    snippet = "\n".join(lines[:line_limit])
    soup = BeautifulSoup(snippet, "html.parser")
    
    h1_tags = soup.find_all("h1")
    has_h1 = len(h1_tags) > 0

    text = soup.get_text(strip=True)
    has_text = bool(text)

    images = soup.find_all("img")
    has_image = len(images) > 0

    result = {
        "has_h1": has_h1,
        "has_text": has_text,
        "has_image": has_image,
        "line_count": line_limit,
        "text_length": len(text),
        "image_count": len(images),
    }
    return result
# ===============================================================================================
def analyze_illegal_techniques(html):
    soup = BeautifulSoup(html, "html.parser")

    result = {
        "meta_refresh_redirect": False,
        "js_redirect": False,
        "hidden_text": False,
        "hidden_form_fields": False,
        "hidden_forms_without_submit": []
    }

    # 1) Redirect via <meta http-equiv='refresh'>
    meta_refresh = soup.find("meta", attrs={"http-equiv": re.compile(r"refresh", re.I)})
    if meta_refresh and meta_refresh.get("content"):
        content = meta_refresh["content"]
        if re.search(r"^\s*0\s*;\s*url\s*=", content, re.I):
            result["meta_refresh_redirect"] = True

    # 2) Redirect via JavaScript
    scripts = soup.find_all("script")
    js_redirect_patterns = [
        r"window\.location\.assign\s*\(",
        r"window\.location\s*=",
        r"window\.location\.href\s*=",
        r"location\.href\s*=",
        r"location\.assign\s*\("
    ]
    for script in scripts:
        if script.string:
            for pattern in js_redirect_patterns:
                if re.search(pattern, script.string):
                    result["js_redirect"] = True
                    break
        if result["js_redirect"]:
            break

    # 3) Hidden text (via styles)
    hidden_text_patterns = [
        r"display\s*:\s*none",
        r"visibility\s*:\s*hidden",
        r"opacity\s*:\s*0",
        r"font-size\s*:\s*0",
        r"color\s*:\s*white",
    ]

    def is_hidden_style(style_str):
        if not style_str:
            return False
        style_str = style_str.lower().replace(" ", "")
        return any(re.search(pat, style_str) for pat in hidden_text_patterns)

    for el in soup.find_all(style=True):
        if is_hidden_style(el["style"]) and el.get_text(strip=True):
            result["hidden_text"] = True
            break

    # 4) Hidden form fields and forms without submit
    for form in soup.find_all("form"):
        #Is there any input type=hidden
        if form.find("input", attrs={"type": "hidden"}):
            result["hidden_form_fields"] = True

        #Is the form or its parent hidden?
        is_hidden = False
        el = form
        while el and getattr(el, 'attrs', None) is not None:
            style = el.attrs.get("style", "").lower().replace(" ", "")
            if any(p in style for p in ["display:none", "visibility:hidden", "opacity:0"]):
                is_hidden = True
                break
            el = el.parent

        if is_hidden:
            result["hidden_form_fields"] = True

        #Is there a send button?
        submit = form.find(["button", "input"], attrs={"type": re.compile(r"^(submit|image)?$", re.I)})
        if not submit:
            result["hidden_forms_without_submit"].append(str(form))  #save all HTML

    return result

# ===============================================================================================
def analyze_mobile_adaptivity(html):
    soup = BeautifulSoup(html, "html.parser")

    result = {
        "has_viewport_meta": False,
        "has_media_queries": False,
        "has_fixed_width": False,
        "has_small_font": False,
        "has_horizontal_scroll_risk": False
    }

    # 1. Перевірка <meta name="viewport">
    viewport = soup.find("meta", attrs={"name": "viewport"})
    result["has_viewport_meta"] = bool(viewport)

    # 2. Flipping @media in CSS(inline or <style>)
    css_text = ""
    style_tags = soup.find_all("style")
    for tag in style_tags:
        if tag.string:
            css_text += tag.string

    result["has_media_queries"] = "@media" in css_text

    # 3. Reversing the fixed width (style="width:500px", or just px)
    fixed_width_found = False
    for tag in soup.find_all(style=True):
        style = tag["style"].replace(" ", "").lower()
        if "width:" in style and re.search(r"width:\d+px", style):
            fixed_width_found = True
            break
    result["has_fixed_width"] = fixed_width_found

    #4. Small font size (font-size: 10px or less)
    small_font_found = False
    for tag in soup.find_all(style=True):
        style = tag["style"].replace(" ", "").lower()
        match = re.search(r"font-size:(\d+)px", style)
        if match and int(match.group(1)) <= 10:
            small_font_found = True
            break
    result["has_small_font"] = small_font_found

    scroll_risk = False
    for tag in soup.find_all(style=True):
        style = tag["style"].replace(" ", "").lower()
        if "overflow-x:scroll" in style or re.search(r"width:\d{4,}px", style):
            scroll_risk = True
            break
    result["has_horizontal_scroll_risk"] = scroll_risk

    return result

# ===============================================================================================
def analyze_load_speed(url):
    result = {
        "ttfb": None,
        "load_time": None,
        "page_size_kb": None,
        "request_count": 0,
        "resource_size_kb": None
    }

    try:
        # TTFB
        start_time = time.time()
        response = requests.get(url, stream=True, timeout=10)
        ttfb = response.elapsed.total_seconds()
        result["ttfb"] = round(ttfb, 3)

        # Measuring the full loading of HTML + resources
        html_start = time.time()
        content = response.content
        html_end = time.time()
        result["load_time"] = round(html_end - start_time, 3)

        result["page_size_kb"] = round(len(content) / 1024, 2)

        soup = BeautifulSoup(content, "html.parser")

        resources = set()
        base_url = "{uri.scheme}://{uri.netloc}".format(uri=urlparse(url))

        # We are looking for basic resources
        for tag in soup.find_all(["img", "script", "link"]):
            src = tag.get("src") or tag.get("href")
            if src:
                full_url = urljoin(base_url, src)
                resources.add(full_url)

        total_resource_size = 0
        successful_requests = 0

        for res_url in list(resources)[:200]:
            try:
                r = requests.get(res_url, stream=True, timeout=5)
                total_resource_size += int(r.headers.get('Content-Length', 0))
                successful_requests += 1
            except:
                continue

        result["request_count"] = successful_requests
        result["resource_size_kb"] = round(total_resource_size / 1024, 2)

    except Exception as e:
        result["error"] = str(e)

    return result
# ===============================================================================================
def fetch_pagespeed_insights(url, strategy) -> dict:
    """
    Запрашивает данные PageSpeed Insights API.

    :param api_key: Ваш API-ключ Google.
    :param url: URL страницы для анализа.
    :param strategy: "mobile" или "desktop" (по умолчанию mobile).
    :return: словарь с результатами API.
    """
    endpoint = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
    params = {
        "url": url,
        "key": "AIzaSyBeCJpoC7p4b_NZ4dlUWtfSv9cUgc75dFI",
        "strategy": strategy,
        "category": ["performance", "accessibility", "best-practices", "seo", "pwa"]
    }
    response = requests.get(endpoint, params=params)
    response.raise_for_status()
    data = response.json()
    
    lighthouse = data.get("lighthouseResult", {})
    categories = lighthouse.get("categories", {})
    audits = lighthouse.get("audits", {})
    
    performance = categories.get("performance", {})
    perf_score = performance.get("score", None)
    if perf_score is not None:
        perf_score = round(perf_score * 100, 1)
        
    keys = [
        "first-contentful-paint",
        "speed-index",
        "largest-contentful-paint",
        "interactive",
        "total-blocking-time",
        "cumulative-layout-shift"
    ]
    
    metrics = {}
    for key in keys:
        audit = audits.get(key, {})
        display_value = audit.get("displayValue", None)
        score = audit.get("score", None)
        if display_value is not None:
            metrics[key] = {
                "display_value": display_value,
                "score": score
            }

    return {
        "performance_score": perf_score,
        "metrics": metrics,
        "final_url": lighthouse.get("finalUrl", url),
        "strategy": strategy,
    }

# ===============================================================================================
# 1. Main entry point
@app.route('/analyze', methods=['POST'])
def analyze():

    result = {
        "title": "",
        "description": "",
        "checks": {},
        "error": ""
    }
    
    try:
        method = request.form.get("method")
        checks = request.form.getlist("checks")

        html = extract_html(request, method)  # Эта функция уже у тебя есть

        if "precheck" in checks:
            result.update(precheck_module(html))

        if "semantic" in checks:
            max_words = int(request.form.get("max_words", 20))
            max_bigrams = int(request.form.get("max_bigrams", 0))
            result["checks"]["semantic"] = extract_semantics(html, max_words, max_bigrams)
            result["checks"]["metrics"] = semantics_analys(result["checks"]["semantic"])
            
        if "user-semantic" in checks:
            user_keywords_input = request.form.get("user_keywords", "")
            user_keywords = [w.strip() for w in user_keywords_input.split(",") if w.strip()]
            result["checks"]["user-semantic"] = compare_with_target_semantics(result["checks"]["semantic"], user_keywords)
            
        if "structure" in checks:
            result["checks"]["structure"] = analyze_html_structure(html)
            result["content_order"] = check_content_order(html)
            result["above_the_fold"] = analyze_above_the_fold(html)
            
        if "illegal-techniques" in checks:
            result["checks"]["illegal_techniques"] = analyze_illegal_techniques(html)
            
        if "mobile-adaptivity" in checks:
            result["checks"]["mobile_adaptivity"] = analyze_mobile_adaptivity(html)
            
        if "performance_speed" in checks and method == "url":
            result["checks"]["performance"] = analyze_load_speed(request.form.get("url"))

        if "pagespeed_insights" in checks:
            strategy = request.form.get("pagespeed_strategy", "mobile")
            result["checks"]["api_data"] = fetch_pagespeed_insights(request.form.get("url"), strategy)
            
    except Exception as e:
        result["error"] = str(e)
    print(result)
    return jsonify(result)

# ===============================================================================================
@app.route('/upload-json', methods=['POST'])
def upload_json():
    if 'jsonfile' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['jsonfile']

    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        content = file.read().decode('utf-8')
        data = json.loads(content)
    except Exception as e:
        return jsonify({"error": f"Invalid JSON: {str(e)}"}), 400
    print(data)
    return jsonify(data)

# ===============================================================================================
@app.route('/')
def index():
    is_render = "semehran-petro-diplome.onrender.com" in request.host
    return render_template("index.html", is_render=is_render)  

if __name__ == '__main__':
    os.makedirs("uploads", exist_ok=True)
    app.run(debug=True)
