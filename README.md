# PHP Serialized Array Studio

Aplicación web ligera para convertir contenido `serialize()` de PHP a una estructura clara, editable y exportable.

## Qué hace

- Parsea texto serializado de PHP a objeto/array usable.
- Muestra un árbol desplegable para inspeccionar datos anidados.
- Permite editar el resultado en JSON y aplicar cambios.
- Exporta el contenido a:
  - JSON
  - Markdown
  - YAML
  - TXT (vista árbol)
  - PDF (captura del visor)
  - PHP serializado
  - Array PHP (`$data = [...]`)

## Demo online

Puedes ver un ejemplo funcionando en:

- https://eljaviero.com/utils/unserialize-php/

## Interfaz

La app tiene 4 zonas principales:

1. Entrada de texto serializado (con carga de archivo).
2. Editor JSON.
3. Vista árbol desplegable.
4. Panel de exportación.

También muestra métricas de:

- Entradas
- Profundidad

## Uso rápido

1. Abre [index.html](./index.html) en el navegador.
2. Pega tu string serializado o carga un archivo.
3. Pulsa `Convertir`.
4. Revisa/edita en el panel JSON.
5. Pulsa `Aplicar cambios` si editaste el JSON.
6. Exporta en el formato que necesites.

## Atajos de teclado

- En entrada serializada: `Ctrl + Enter` (o `Cmd + Enter`) para convertir.
- En editor JSON: `Ctrl + Enter` (o `Cmd + Enter`) para aplicar cambios.

## Formatos de archivo aceptados al cargar

- `.txt`
- `.php`
- `.ser`
- `.log`

## Seguridad CDN

Las librerías externas cargadas por CDN incluyen `integrity` (SRI) y `crossorigin="anonymous"` para reducir riesgo de manipulación:

- Bootstrap CSS
- jQuery
- jsPDF
- html2canvas

## Estructura del proyecto

```text
.
|- index.html     # Estructura de la app
|- style.css      # Estilos
|- app.js         # Parser, render, eventos y exportación
|- constants.js   # Configuración central (APP_CONFIG)
|- README.md      # Documentación del proyecto
```

## Notas técnicas

- El parser contempla longitudes en bytes UTF-8 para strings serializadas.
- El proyecto es front-end puro (sin build, sin dependencias locales).
- Codificación recomendada de archivos: UTF-8.

## Licencia

Pendiente de definir.