# Baco-Fit — App contador de calorías

## 1. Resumen

Aplicación de registro de ingesta calórica. No tiene interfaz de entrada de datos propia: la captura de datos ocurre fuera de la app, a través de un bot de Telegram orquestado por un escenario de Make, que usa una IA para interpretar el mensaje del usuario y transformarlo en una llamada estructurada a un endpoint HTTP expuesto por esta app.

Esta app es responsable únicamente de:
- Exponer un endpoint HTTP que recibe y persiste entradas de alimentos ya interpretadas.
- Exponer una vista web mínima de consulta (resumen diario, histórico, listado de entradas).

Esta app **no** es responsable de:
- Interpretar lenguaje natural ni calcular calorías/macros (eso lo hace la IA en Make, antes de llamar al endpoint).
- Comunicarse con Telegram (eso lo hace Make).

## 2. Actores

| Actor | Descripción |
|---|---|
| Usuario final | Persona que envía mensajes al bot de Telegram describiendo lo que ha comido. Varias personas (familia/amigos) usan el mismo bot. |
| Escenario de Make | Flujo externo que recibe el mensaje de Telegram, lo pasa por una IA, y hace el `POST` al endpoint de esta app. Es el único cliente del endpoint. |
| App contador de calorías | Sistema descrito en este documento. Recibe el `POST`, persiste los datos, y sirve una vista de consulta. |

Esta app no interactúa nunca directamente con Telegram ni con el usuario final en tiempo de registro; solo lo hace cuando el usuario final abre la vista web de consulta.

## 3. Identidad de usuario

- No hay sistema de login propio.
- La identidad de cada usuario es su `telegram_user_id`.
- Cada `telegram_user_id` tiene su propio objetivo diario y sus propios datos.
- Los usuarios no comparten datos entre sí: cada uno ve exclusivamente su propia información en la vista web.

## 4. Modelo de datos

### 4.1 Usuario

| Campo | Tipo | Descripción |
|---|---|---|
| `telegram_user_id` | string/number | Identificador único del usuario, proviene de Telegram. |
| `objetivo_calorias` | number | Objetivo diario de calorías. Fijo, no varía por día. |
| `objetivo_macros` | object | `{ proteina, grasa, carbohidratos }`. Objetivo diario fijo de macronutrientes (en gramos). |

El objetivo es fijo por usuario: no existe el concepto de objetivo distinto por día de la semana, día de entreno, etc. (fuera de alcance, ver sección 7).

### 4.2 Entrada de registro (payload recibido por el endpoint)

Cada llamada al endpoint representa **un mensaje de Telegram**, que puede contener **uno o varios alimentos**.

```json
{
  "telegram_user_id": "123456789",
  "fecha": "2026-10-10",
  "categoria": "desayuno",
  "alimentos": [
    {
      "nombre": "tostada con mantequilla",
      "cantidad": "2 unidades",
      "calorias": 180,
      "macros": {
        "proteina": 4,
        "grasa": 7,
        "carbohidratos": 24
      },
      "certeza": 55,
      "motivo_certeza_baja": "No se especifica si lleva mantequilla, aceite o mermelada, ni la cantidad exacta"
    }
  ]
}
```

Notas sobre los campos:

- `fecha`: solo fecha (`YYYY-MM-DD`), sin componente horario. No existe timestamp exacto de consumo.
- `categoria`: ventana de ingesta del día. Enum cerrado, ejemplo: `desayuno`, `comida`, `merienda`, `cena`, `snack`. Es única por llamada (aplica a todos los alimentos del array `alimentos` de esa llamada).
- `alimentos`: array de 1 o más ítems. Cada ítem representa un alimento distinto detectado en el mensaje.
- `nombre`, `cantidad`: texto libre, tal como lo determina la IA de Make.
- `calorias`: ya calculadas por la IA de Make. La app no recalcula ni valida este valor.
- `macros`: ya calculados por la IA de Make, en gramos. La app no recalcula ni valida este valor.
- `certeza`: porcentaje (0-100) calculado por la IA de Make según cuánta ambigüedad hay en la descripción del alimento (ej. "un café y una tostada" tiene certeza baja porque no se especifica si el café lleva leche, ni qué lleva la tostada).
- `motivo_certeza_baja`: texto libre explicando por qué la certeza es baja. Presente solo cuando la certeza es baja (umbral a definir en implementación); opcional en el payload.

La app persiste estos datos tal cual los recibe, sin aplicar lógica de cálculo, validación nutricional ni corrección automática.

### 4.3 Entrada persistida

Es el resultado de "desenrollar" el array `alimentos` del payload: cada alimento del array se persiste como una entrada individual, heredando `telegram_user_id`, `fecha` y `categoria` de la llamada que lo contenía.

| Campo | Origen |
|---|---|
| `telegram_user_id` | de la llamada |
| `fecha` | de la llamada |
| `categoria` | de la llamada |
| `nombre` | del ítem |
| `cantidad` | del ítem |
| `calorias` | del ítem |
| `macros` | del ítem |
| `certeza` | del ítem |
| `motivo_certeza_baja` | del ítem (opcional) |

## 5. Endpoint

- **Método/ruta**: `POST /entries` (nombre de ruta orientativo, no definitivo).
- **Cliente**: exclusivamente el escenario de Make. No hay otros consumidores previstos.
- **Autenticación**: API key fija compartida, enviada en un header (ej. `Authorization` o `X-Api-Key`). Un único secreto para todo el flujo, sin rotación ni múltiples claves por usuario.
- **Body**: ver estructura en sección 4.2.
- **Comportamiento esperado**:
  1. Validar el header de autenticación.
  2. Persistir cada alimento del array `alimentos` como una entrada individual (sección 4.3), sin transformar ni recalcular calorías/macros/certeza.
  3. No hay deduplicación ni idempotencia especificada: cada llamada genera entradas nuevas.
- **Respuesta**: confirmación simple de éxito o error (ej. `200 OK` / `4xx`/`5xx` con un cuerpo mínimo). No se espera que la respuesta incluya totales acumulados ni datos de resumen; Make no usa la respuesta para responder al usuario en Telegram con información calculada por la app.

## 6. Vista web de consulta

Para cada usuario (identificado implícitamente por su `telegram_user_id`, sin login), la vista debe permitir:

1. **Resumen del día**: total de calorías y de cada macro consumidos en una fecha, comparado contra el objetivo del usuario (sección 4.1).
2. **Histórico**: evolución de calorías/macros a lo largo de varios días o semanas.
3. **Listado de entradas de un día**: todas las entradas persistidas de esa fecha, agrupadas o filtrables por `categoria`, mostrando un indicador visual cuando `certeza` es baja (sin acción de edición asociada).
4. **Configuración de objetivo**: pantalla para definir/consultar `objetivo_calorias` y `objetivo_macros` del usuario (fijo, no por día).

No se requiere:
- Edición ni borrado de entradas.
- Login propio (se asume acceso directo o algún mecanismo simple fuera de alcance de este documento).
- Vista agregada o comparativa entre distintos usuarios.

## 7. Explícitamente fuera de alcance (v1)

- Edición o borrado de entradas ya registradas.
- Login/autenticación propia de usuario final (se usa `telegram_user_id` como identidad implícita).
- Vista compartida o comparativa entre varios usuarios (cada usuario ve solo lo suyo).
- Objetivos diarios variables (por día de la semana, por día de entreno, etc.): el objetivo es fijo por usuario.
- Timestamp exacto de consumo: solo se registra fecha + categoría, nunca hora.
- Recálculo, validación o corrección de calorías/macros/certeza por parte de la app: estos valores son siempre los que llegan en el payload, calculados externamente por la IA del flujo de Make.
- Respuesta enriquecida del endpoint hacia Make (totales acumulados, mensajes personalizados, etc.): solo confirmación de éxito/error.
- Integración directa con Telegram: toda la interacción con Telegram ocurre en el escenario de Make, fuera de esta app.

## 8. Supuestos y puntos abiertos para implementación

- El enum de `categoria` (ventanas de ingesta) debe fijarse en implementación; este documento asume al menos `desayuno`, `comida`, `merienda`, `cena`, `snack`, pero el conjunto final no está cerrado.
- El umbral de `certeza` que determina qué se considera "baja" (para mostrar el indicador visual) debe definirse en implementación.
- La zona horaria usada para interpretar `fecha` no está especificada; dado que no hay componente horario, se asume que `fecha` llega ya resuelta en la zona horaria correcta desde Make.
- No se ha definido mecanismo de acceso a la vista web (si requiere algún tipo de autenticación ligera o es de acceso directo); queda fuera de alcance de este documento funcional.
