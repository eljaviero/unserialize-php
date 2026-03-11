const sampleInput = 'a:9:{s:2:"id";i:1254;s:6:"titulo";s:19:"Artículo de prueba";s:5:"autor";a:3:{s:2:"id";i:87;s:6:"nombre";s:11:"Juan Pérez";s:5:"email";s:16:"juan@example.com";}s:4:"tags";a:3:{i:0;s:3:"php";i:1;s:5:"mysql";i:2;s:7:"backend";}s:9:"publicado";b:1;s:17:"fecha_publicacion";s:19:"2025-12-10 18:30:00";s:12:"estadisticas";a:3:{s:7:"visitas";i:1543;s:5:"likes";i:230;s:11:"compartidos";i:54;}s:11:"comentarios";a:2:{i:0;a:3:{s:7:"usuario";s:11:"Ana García";s:5:"texto";s:18:"Muy buen artículo";s:5:"fecha";s:10:"2025-12-11";}i:1;a:3:{s:7:"usuario";s:13:"Pedro Méndez";s:5:"texto";s:19:"Gracias por la info";s:5:"fecha";s:10:"2025-12-12";}}s:8:"metadata";N;}';
const encoder = new TextEncoder();

const state = {
  data: null,
};

const $serializedInput = $("#serialized-input");
const $jsonEditor = $("#json-editor");
const $treeView = $("#tree-view");
const $status = $("#status-message");
const $metricEntries = $("#metric-entries");
const $metricDepth = $("#metric-depth");
function applyFooterConstants() {
  $("#footer-by-name").text(APP_CONFIG.footerByName);
  $("#footer-link")
    .text(APP_CONFIG.footerLinkText)
    .attr("href", APP_CONFIG.footerLinkUrl);
}

function setStatus(message, type) {
  $status.removeClass("success error").addClass(type || "").text(message || "");
}

function parseSerialized(input) {
  let index = 0;

  function expect(char) {
    if (input[index] !== char) {
      throw new Error(`Se esperaba "${char}" en la posición ${index}, se encontró "${input[index] || "EOF"}".`);
    }
    index += 1;
  }

  function readUntil(delimiter) {
    const start = index;
    const end = input.indexOf(delimiter, start);
    if (end === -1) {
      throw new Error(`No se encontró el delimitador "${delimiter}" desde la posición ${start}.`);
    }
    index = end + delimiter.length;
    return input.slice(start, end);
  }

  function readNumber(untilChar) {
    const raw = readUntil(untilChar);
    const number = Number(raw);
    if (Number.isNaN(number)) {
      throw new Error(`Número inválido "${raw}".`);
    }
    return number;
  }

  function readSerializedString(byteLength) {
    let value = "";
    let consumed = 0;

    while (index < input.length && consumed < byteLength) {
      const codePoint = input.codePointAt(index);
      if (codePoint === undefined) {
        break;
      }

      const char = String.fromCodePoint(codePoint);
      const charBytes = encoder.encode(char).length;
      if (consumed + charBytes > byteLength) {
        break;
      }

      value += char;
      consumed += charBytes;
      index += char.length;
    }

    if (consumed !== byteLength) {
      throw new Error(`Longitud de cadena inválida. Esperados ${byteLength} bytes.`);
    }

    return value;
  }

  function parseValue() {
    const type = input[index];
    if (!type) {
      throw new Error(`Valor incompleto en la posición ${index}.`);
    }

    const separator = input[index + 1];
    if (type === "N") {
      if (separator !== ";") {
        throw new Error(`Se esperaba ";" tras null en la posición ${index + 1}.`);
      }
      index += 2;
      return null;
    }

    if (separator !== ":") {
      throw new Error(`Se esperaba ":" tras el tipo "${type}" en la posición ${index + 1}.`);
    }

    index += 2;

    switch (type) {
      case "i":
      case "d":
        return readNumber(";");
      case "b":
        return readUntil(";") === "1";
      case "s": {
        const byteLength = readNumber(":");
        expect('"');
        const value = readSerializedString(byteLength);
        expect('"');
        expect(";");
        return value;
      }
      case "a": {
        const count = readNumber(":");
        expect("{");
        const entries = [];
        for (let i = 0; i < count; i += 1) {
          const key = parseValue();
          const value = parseValue();
          entries.push([key, value]);
        }
        expect("}");
        return normalizePhpArray(entries);
      }
      default:
        throw new Error(`Tipo "${type}" no soportado en la posición ${index - 2}.`);
    }
  }

  const result = parseValue();
  if (index !== input.length) {
    throw new Error(`Contenido extra sin procesar desde la posición ${index}.`);
  }
  return result;
}

function normalizePhpArray(entries) {
  if (entries.length === 0) {
    return [];
  }

  const isSequential = entries.every(([key], idx) => Number.isInteger(key) && key === idx);
  if (isSequential) {
    return entries.map(([, value]) => value);
  }

  return Object.fromEntries(entries.map(([key, value]) => [String(key), value]));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isContainer(value) {
  return Array.isArray(value) || isPlainObject(value);
}

function getDepth(value) {
  if (!isContainer(value)) {
    return 0;
  }

  const children = Array.isArray(value) ? value : Object.values(value);
  if (children.length === 0) {
    return 1;
  }

  return 1 + Math.max(...children.map((entry) => getDepth(entry)));
}

function countEntries(value) {
  if (Array.isArray(value)) {
    return value.reduce((acc, entry) => acc + countEntries(entry), value.length);
  }

  if (isPlainObject(value)) {
    return Object.values(value).reduce((acc, entry) => acc + countEntries(entry), Object.keys(value).length);
  }

  return 0;
}

function updateMetrics() {
  if (state.data === null) {
    $metricEntries.text("0");
    $metricDepth.text("0");
    return;
  }

  $metricEntries.text(String(countEntries(state.data)));
  $metricDepth.text(String(getDepth(state.data)));
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function scalarClass(value) {
  if (value === null) {
    return "tree-null";
  }
  if (typeof value === "boolean") {
    return "tree-boolean";
  }
  if (typeof value === "number") {
    return "tree-number";
  }
  return "tree-string";
}

function formatScalar(value) {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return `"${value}"`;
  }
  return String(value);
}

function buildTreeHtml(value, key) {
  const safeKey = `<span class="tree-key">${escapeHtml(key)}</span>`;

  if (Array.isArray(value)) {
    const children = value.map((item, index) => buildTreeHtml(item, `[${index}]`)).join("");
    return `
      <details class="tree-node" open>
        <summary class="tree-line">${safeKey}: <span class="tree-meta">Array(${value.length})</span></summary>
        <div class="tree-children">${children}</div>
      </details>`;
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value).map(([childKey, childValue]) => buildTreeHtml(childValue, childKey)).join("");
    return `
      <details class="tree-node" open>
        <summary class="tree-line">${safeKey}: <span class="tree-meta">Object(${Object.keys(value).length})</span></summary>
        <div class="tree-children">${entries}</div>
      </details>`;
  }

  return `<div class="tree-line">${safeKey}: <span class="${scalarClass(value)}">${escapeHtml(formatScalar(value))}</span></div>`;
}

function toTreeText(value, key = "root", depth = 0) {
  const indent = depth === 0 ? "" : `${"  ".repeat(depth - 1)}|- `;

  if (Array.isArray(value)) {
    const lines = [`${indent}${key}: Array(${value.length})`];
    value.forEach((entry, idx) => {
      lines.push(...toTreeText(entry, `[${idx}]`, depth + 1));
    });
    return lines;
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    const lines = [`${indent}${key}: Object(${keys.length})`];
    keys.forEach((childKey) => {
      lines.push(...toTreeText(value[childKey], childKey, depth + 1));
    });
    return lines;
  }

  return [`${indent}${key}: ${formatScalar(value)}`];
}

function renderTreeView() {
  if (state.data === null) {
    $treeView.html('<div class="tree-empty">Convierte un array serializado para ver el árbol.</div>');
    return;
  }

  $treeView.html(buildTreeHtml(state.data, "root"));
}

function syncView() {
  if (state.data === null) {
    $jsonEditor.val("");
  } else {
    $jsonEditor.val(JSON.stringify(state.data, null, 2));
  }
  renderTreeView();
  updateMetrics();
}

function setData(data, message) {
  state.data = data;
  syncView();
  if (message) {
    setStatus(message, "success");
  }
}

function getByteLength(text) {
  return encoder.encode(text).length;
}

function serializePhp(value) {
  if (value === null) {
    return "N;";
  }

  if (Array.isArray(value)) {
    const content = value.map((item, index) => `${serializePhp(index)}${serializePhp(item)}`).join("");
    return `a:${value.length}:{${content}}`;
  }

  switch (typeof value) {
    case "string":
      return `s:${getByteLength(value)}:"${value}";`;
    case "number":
      return Number.isInteger(value) ? `i:${value};` : `d:${value};`;
    case "boolean":
      return `b:${value ? 1 : 0};`;
    case "object": {
      const entries = Object.entries(value);
      const content = entries.map(([k, v]) => `${serializePhp(k)}${serializePhp(v)}`).join("");
      return `a:${entries.length}:{${content}}`;
    }
    default:
      throw new Error(`Tipo no soportado para serializar: ${typeof value}`);
  }
}

function toMarkdown(value, depth = 0) {
  const indent = "  ".repeat(depth);

  if (Array.isArray(value)) {
    return value
      .map((entry) => (isContainer(entry) ? `${indent}-\n${toMarkdown(entry, depth + 1)}` : `${indent}- ${formatScalar(entry)}`))
      .join("\n");
  }

  if (isPlainObject(value)) {
    return Object.entries(value)
      .map(([key, entry]) =>
        isContainer(entry)
          ? `${indent}- **${key}**\n${toMarkdown(entry, depth + 1)}`
          : `${indent}- **${key}:** ${formatScalar(entry)}`
      )
      .join("\n");
  }

  return `${indent}- ${formatScalar(value)}`;
}

function escapeYamlKey(key) {
  return /^[a-zA-Z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
}

function formatYamlScalar(value) {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  return String(value);
}

function toYaml(value, depth = 0) {
  const indent = "  ".repeat(depth);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `${indent}[]`;
    }
    return value
      .map((entry) => (isContainer(entry) ? `${indent}-\n${toYaml(entry, depth + 1)}` : `${indent}- ${formatYamlScalar(entry)}`))
      .join("\n");
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return `${indent}{}`;
    }
    return entries
      .map(([key, entry]) =>
        isContainer(entry)
          ? `${indent}${escapeYamlKey(key)}:\n${toYaml(entry, depth + 1)}`
          : `${indent}${escapeYamlKey(key)}: ${formatYamlScalar(entry)}`
      )
      .join("\n");
  }

  return `${indent}${formatYamlScalar(value)}`;
}

function toPhpArray(value, depth = 0) {
  const indent = "  ".repeat(depth);
  const nextIndent = "  ".repeat(depth + 1);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }

    const lines = value.map((entry) => `${nextIndent}${toPhpArray(entry, depth + 1)}`);
    return `[\n${lines.join(",\n")}\n${indent}]`;
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return "[]";
    }

    const lines = entries.map(([key, entry]) => `${nextIndent}${JSON.stringify(key)} => ${toPhpArray(entry, depth + 1)}`);
    return `[\n${lines.join(",\n")}\n${indent}]`;
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value);
}
function downloadText(filename, content, mimeType) {
  const blob = new Blob([content], { type: `${mimeType};charset=UTF-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}



async function exportPdfTree() {
  if (state.data === null) {
    setStatus("Convierte primero un array serializado.", "error");
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    setStatus("No se pudo cargar el motor PDF (jsPDF).", "error");
    return;
  }

  if (!window.html2canvas) {
    setStatus("No se pudo cargar el motor de captura (html2canvas).", "error");
    return;
  }

  const treeElement = document.getElementById("tree-view");
  if (!treeElement) {
    setStatus("No se encontró el visor de árbol.", "error");
    return;
  }

  const originalHeight = treeElement.style.height;
  const originalMinHeight = treeElement.style.minHeight;
  const originalMaxHeight = treeElement.style.maxHeight;
  const originalOverflow = treeElement.style.overflow;

  try {
    treeElement.style.height = `${treeElement.scrollHeight}px`;
    treeElement.style.minHeight = `${treeElement.scrollHeight}px`;
    treeElement.style.maxHeight = "none";
    treeElement.style.overflow = "visible";

    const captureScale = 2;
    const treeRect = treeElement.getBoundingClientRect();
    const visibleLineBottomsPx = Array.from(treeElement.querySelectorAll(".tree-line"))
      .map((node) => Math.round((node.getBoundingClientRect().bottom - treeRect.top) * captureScale))
      .filter((value, index, arr) => value > 0 && (index === 0 || value !== arr[index - 1]));

    const canvas = await window.html2canvas(treeElement, {
      backgroundColor: "#fcfcfd",
      scale: captureScale,
      useCORS: true,
    });

    const doc = new window.jspdf.jsPDF({ orientation: "p", unit: "pt", format: "a4" });
    const marginTop = 24;
    const marginBottom = 24;
    const marginHorizontal = 24;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - marginHorizontal * 2;
    const printableHeight = pageHeight - marginTop - marginBottom;
    const pageSliceHeightPx = Math.floor((printableHeight * canvas.width) / contentWidth);

    // Prefer page breaks at line boundaries to avoid cutting text.
    const minSliceHeightPx = Math.max(80, Math.floor(pageSliceHeightPx * 0.35));

    let offsetY = 0;
    while (offsetY < canvas.height) {
      if (offsetY > 0) {
        doc.addPage();
      }

      let sliceHeight = Math.min(pageSliceHeightPx, canvas.height - offsetY);
      if (offsetY + sliceHeight < canvas.height && visibleLineBottomsPx.length > 0) {
        const targetEnd = offsetY + sliceHeight;
        const breakAt = [...visibleLineBottomsPx]
          .reverse()
          .find((value) => value <= targetEnd && value - offsetY >= minSliceHeightPx);

        if (breakAt) {
          sliceHeight = breakAt - offsetY;
        }
      }
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;

      const pageCtx = pageCanvas.getContext("2d");
      if (!pageCtx) {
        throw new Error("No se pudo preparar una página intermedia para el PDF.");
      }

      pageCtx.drawImage(canvas, 0, offsetY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

      const sliceHeightPt = (sliceHeight * contentWidth) / canvas.width;
      doc.addImage(pageCanvas.toDataURL("image/png"), "PNG", marginHorizontal, marginTop, contentWidth, sliceHeightPt);

      offsetY += sliceHeight;
    }

    doc.save("serialized-array-tree.pdf");
    setStatus("PDF exportado correctamente con el formato del visor.", "success");
  } catch (error) {
    setStatus(`No se pudo generar el PDF: ${error.message}`, "error");
  } finally {
    treeElement.style.height = originalHeight;
    treeElement.style.minHeight = originalMinHeight;
    treeElement.style.maxHeight = originalMaxHeight;
    treeElement.style.overflow = originalOverflow;
  }
}
function exportCurrent(format) {
  if (state.data === null) {
    setStatus("Convierte primero un array serializado.", "error");
    return;
  }

  if (format === "pdf") {
    exportPdfTree();
    return;
  }

  switch (format) {
    case "json":
      downloadText("serialized-array.json", JSON.stringify(state.data, null, 2), "application/json");
      break;
    case "markdown":
      downloadText("serialized-array.md", toMarkdown(state.data), "text/markdown");
      break;
    case "yaml":
      downloadText("serialized-array.yml", toYaml(state.data), "text/yaml");
      break;
    case "txt":
      downloadText("serialized-array.txt", toTreeText(state.data).join("\n"), "text/plain");
      break;
    case "php":
      downloadText("serialized-array.txt", serializePhp(state.data), "text/plain");
      break;
    case "arrayphp": {
      const phpArray = toPhpArray(state.data);
      const payload = `<?php\n$data = ${phpArray};\n`;
      downloadText("array-data.php", payload, "text/x-php");
      break;
    }
    default:
      return;
  }

  setStatus(`Exportado como ${format.toUpperCase()}.`, "success");
}

function handleParse() {
  try {
    const parsed = parseSerialized($serializedInput.val().trim());
    setData(parsed, "Array serializado convertido correctamente.");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

function handleApplyEditor() {
  try {
    const parsed = JSON.parse($jsonEditor.val());
    setData(parsed, "Cambios del JSON aplicados.");
    $serializedInput.val(serializePhp(parsed));
  } catch (error) {
    setStatus(`JSON inválido: ${error.message}`, "error");
  }
}

function handleFormatJson() {
  const raw = $jsonEditor.val().trim();
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    $jsonEditor.val(JSON.stringify(parsed, null, 2));
    setStatus("JSON reformateado.", "success");
  } catch (error) {
    setStatus(`No se pudo reformatear: ${error.message}`, "error");
  }
}

function clearAll() {
  state.data = null;
  $serializedInput.val("");
  $jsonEditor.val("");
  syncView();
  setStatus("Contenido borrado.", "success");
}

function bindEvents() {
  $("#parse-input").on("click", handleParse);
  $("#apply-editor").on("click", handleApplyEditor);
  $("#format-json").on("click", handleFormatJson);
  $("#clear-all").on("click", clearAll);

  $("#load-file").on("click", () => {
    $("#file-input").trigger("click");
  });

  $("#file-input").on("change", async function onFileChange() {
    const file = this.files && this.files[0];
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      $serializedInput.val(content);
      setStatus(`Archivo cargado: ${file.name}.`, "success");
    } catch (error) {
      setStatus(`No se pudo leer el archivo: ${error.message}`, "error");
    }

    this.value = "";
  });

  $("[data-export]").on("click", function onExportClick() {
    exportCurrent($(this).data("export"));
  });

  $serializedInput.on("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      handleParse();
    }
  });

  $jsonEditor.on("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      handleApplyEditor();
    }
  });
}

function init() {
  bindEvents();
  $("#copyright-year").text(String(new Date().getFullYear()));
  applyFooterConstants();
  $serializedInput.attr("placeholder", sampleInput);
  $serializedInput.val(sampleInput);
  handleParse();
}

$(init);













