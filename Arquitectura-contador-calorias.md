# Baco-Fit — Arquitectura de la app contador de calorías

Este documento complementa a `App-contador-calorias.md` (especificación funcional) y detalla las decisiones de arquitectura técnica. Está pensado para que otra IA pueda analizarlo junto al documento funcional antes de implementar.

## 1. Stack

- **Framework**: Next.js con App Router (`app/`), TypeScript.
- **Despliegue**: Vercel. Variables de entorno (credenciales AWS, API key del endpoint) gestionadas en el dashboard de Vercel.
- **Repositorio**: nuevo repo independiente (no comparte código con `home-expenses`), aunque reutiliza el mismo patrón de acceso a datos que ya se usa allí.
- **Entornos**: uno solo (producción). No hay separación de tablas ni despliegues dev/prod.
- **Base de datos**: Amazon DynamoDB, acceso vía [ElectroDB](https://electrodb.dev/) (en lugar de la librería `dynamodb-adapter` que usa `home-expenses` en `domain/src/repositories/DbAdapterFactory.ts`), configurada con `accessKeyId` / `secretAccessKey` / `region` por variables de entorno.

## 2. Decisión de modelado: single-table design (Opción B)

Se descartó un diseño con dos tablas de partition-key simple resueltas con `scan()` (válido pero con coste creciente sin límite, ya que las entradas nunca se purgan). Se adopta en su lugar un diseño de **tabla única** con partition key + sort key compuesta, que permite resolver todos los patrones de acceso con `query` (sin `scan`) desde el día uno.

### 2.1 Tabla

- **Nombre**: `calorie_app` (nombre orientativo).
- **Partition key (PK)**: `telegram_user_id` (string).
- **Sort key (SK)**: string compuesta, formato depende del tipo de item (ver 2.2).

Toda la información de un usuario (su configuración y todas sus entradas) vive bajo la misma partition key, lo que permite acotar siempre las queries a "los datos de este usuario" sin tocar los de otros.

### 2.2 Tipos de item

**Item de configuración de usuario**

| Atributo | Valor |
|---|---|
| `telegram_user_id` (PK) | ej. `"123456789"` |
| `SK` | constante `"CONFIG"` |
| `objetivo_calorias` | number |
| `objetivo_macros` | `{ proteina, grasa, carbohidratos }` |

**Item de entrada de alimento** (uno por cada alimento persistido, ver sección 4.3 del documento funcional)

| Atributo | Valor |
|---|---|
| `telegram_user_id` (PK) | ej. `"123456789"` |
| `SK` | `"{fecha}#{categoria}#{id}"`, ej. `"2026-10-10#desayuno#a1b2c3d4"` |
| `fecha` | `"2026-10-10"` (duplicado como atributo plano, además de ir embebido en la SK, para que quede legible sin parsear la SK) |
| `categoria` | `"desayuno"` |
| `id` | uuid del alimento, generado al persistir |
| `nombre` | string |
| `cantidad` | string |
| `calorias` | number |
| `macros` | `{ proteina, grasa, carbohidratos }` |
| `certeza` | number (0-100) |
| `motivo_certeza_baja` | string, opcional |

**Por qué este orden en la SK (`fecha#categoria#id`)**: la fecha en formato `YYYY-MM-DD` ordena lexicográficamente igual que cronológicamente, así que `query` con `begins_with` o `between` sobre la SK permite acotar por fecha o rango de fechas directamente, sin `scan` y sin necesidad de índices secundarios.

### 2.3 Patrones de acceso (access patterns)

| Caso de uso | Operación | Condición de key |
|---|---|---|
| Guardar una entrada de alimento | `PutItem` | PK = `telegram_user_id`, SK = `{fecha}#{categoria}#{uuid}` (uuid generado al escribir) |
| Leer/crear objetivo del usuario | `GetItem` / `PutItem` | PK = `telegram_user_id`, SK = `"CONFIG"` |
| Resumen del día (todas las categorías) | `Query` | PK = `telegram_user_id`, SK `begins_with "{fecha}#"` |
| Listado filtrado por categoría de un día | `Query` | PK = `telegram_user_id`, SK `begins_with "{fecha}#{categoria}#"` |
| Histórico (rango de fechas) | `Query` | PK = `telegram_user_id`, SK `between "{fechaInicio}#" and "{fechaFin}#"` (sentinel alto para incluir todo lo del último día) |

No se necesita ningún índice secundario global (GSI): todos los patrones de acceso quedan cubiertos por PK + SK de la tabla base.

### 2.4 Escritura de una llamada al endpoint

Cada llamada al endpoint (ver sección 5 del documento funcional) trae un array `alimentos`. Al persistir:

1. Por cada alimento del array, generar un `id` (uuid) nuevo.
2. Construir el item de entrada (tabla 2.2) con SK = `{fecha}#{categoria}#{id}`.
3. Escribir cada item con `PutItem` (secuencial o en batch, a definir en implementación — a este volumen no es una decisión crítica de rendimiento).

No hay upsert ni deduplicación: cada alimento del array genera siempre un item nuevo.

## 3. Por qué ElectroDB en lugar de `dynamodb-adapter`

`home-expenses` usa `dynamodb-adapter` para acceder a DynamoDB, pero esa librería solo genera `KeyConditionExpression` de igualdad exacta sobre la sort key (`sortKey = :valor`): no soporta `begins_with` ni `between`. Los patrones de acceso de la sección 2.3 "resumen del día" y "histórico por rango de fechas" necesitan precisamente esos dos operadores sobre la SK, así que `dynamodb-adapter` no los puede resolver sin recurrir a `@aws-sdk/lib-dynamodb` a mano o extender la propia librería.

Para evitar esa doble vía (una librería para unas operaciones, SDK a mano para otras), se adopta [ElectroDB](https://electrodb.dev/) como capa de acceso única para este proyecto:

- Soporta `begins_with` y `between` de forma nativa en sus `query`, además de igualdad exacta, cubriendo los cinco patrones de acceso de la sección 2.3 sin salir de la librería.
- Modela el single-table design (entidades, PK/SK compuestas) de forma explícita vía su `schema`, lo que documenta en código la estructura de la sección 2.2 en lugar de construir las keys a mano en cada repositorio.
- Es una librería distinta a la que usa `home-expenses`; no hay código compartido entre ambos repos, así que no hay coste de migración ni inconsistencia que resolver, solo una elección de librería independiente para este proyecto nuevo.

ElectroDB usa `@aws-sdk/lib-dynamodb` por debajo, así que las credenciales (`accessKeyId` / `secretAccessKey` / `region`) se configuran igual que se describe en la sección 1.

## 4. Endpoint y seguridad

(Ya definido en la especificación funcional, se repite aquí por completitud de la vista de arquitectura.)

- `POST /api/entries` (ruta bajo App Router: `app/api/entries/route.ts`).
- Autenticación: API key fija compartida, validada en el propio route handler contra una variable de entorno (`ENTRIES_API_KEY` o similar) antes de tocar DynamoDB.
- Variables de entorno necesarias en Vercel: `DB_ACCESS_KEY_ID`, `DB_SECRET_ACCESS_KEY`, `DB_REGION`, `ENTRIES_API_KEY`.

## 5. Vista web

- Rutas bajo `app/` (App Router) para: resumen del día, histórico, listado de entradas de un día, configuración de objetivo — correspondientes 1:1 a los patrones de acceso de la sección 2.3.
- Sin autenticación de usuario final especificada todavía (fuera de alcance, ver documento funcional, sección 8).

## 7. Organización del código: patrón de `home-expenses` a replicar

`home-expenses` (repo hermano, mismo autor) sigue una arquitectura limpia/hexagonal con una separación de capas muy clara, que vale la pena replicar en Baco-Fit aunque el proyecto sea más pequeño. Así es como está organizado allí:

### Monorepo con npm workspaces

- `package.json` raíz declara `"workspaces": ["domain", "services"]`.
- `domain/`: paquete independiente (`home-expenses-domain`) con toda la lógica de negocio, compilado de TypeScript a JS (`domain/lib`) antes de que la app lo consuma. Build: `npm run build:domain && npm run build:next`.
- `services/`: paquete con clientes HTTP (`fetch`) que la UI usa para hablar con las rutas `/api` propias de la app — **no** hablan con la capa `domain` directamente, solo con los route handlers.
- La app raíz (Next.js) importa `domain` como dependencia de workspace (`"home-expenses-domain": "1"`) y usa `services` desde los componentes/hooks de React.

### Capa `domain` (lógica de negocio)

Dentro de `domain/src/`:

- **`domain/models/`**: entidades (ej. `Expense.ts`, `Guest.ts`). Clases planas con métodos `fromDto(dto)` / `fromPrimitives(data)` para construir la entidad desde distintos orígenes, y `flatten()` para volver a un objeto plano serializable. Encapsulan las reglas de conversión, no tienen dependencias de infraestructura.
- **`domain/services/`**: lógica de dominio que no pertenece a una sola entidad (ej. `InvoiceService`, `TimetableService`).
- **`application/<feature>/<verbo><Entidad>UseCase.ts`**: un caso de uso = una clase con un único método público `execute(...)`. Decorada con `@injectable()`, recibe sus dependencias (repositorios) por constructor con `@inject(Types.Repository.X)`. Ejemplo (`addExpenseUseCase.ts`): convierte el DTO a entidad (`Expense.fromDto`) y delega en el repositorio.
- **`repositories/`**: adaptadores de infraestructura (`ExpenseRepository`, `GuestRepository` sobre DynamoDB vía `DbAdapterFactory`; `PdfReader`, `ExpenseParser` para otras integraciones). Son la única capa que conoce el detalle de la base de datos.
- **`di.ts` + `types.ts`**: contenedor de inyección de dependencias con `inversify`. `types.ts` define símbolos (`Types.Repository.Expense`, `Types.UseCase.AddExpense`...); `di.ts` hace el `DI.bind(Types.X).to(ClaseY)`.
- **`index.ts`**: punto de entrada público del paquete — exporta `DI`, `Types`, `config`, y en algunos casos instancias ya construidas de casos de uso.

### Rutas de API finas

Cada `app/api/<recurso>/route.js` es deliberadamente delgado: resuelve el caso de uso desde el contenedor DI y traduce la respuesta, sin lógica propia.

```javascript
import {DI, Types} from 'home-expenses-domain'
import {NextResponse} from 'next/server'

export async function POST(request) {
  const {id, name, amount, paid, period} = await request.json()
  const usecase = DI.get(Types.UseCase.AddExpense)
  await usecase.execute({id, name, amount, paid, period})
  return NextResponse.json({})
}
```

### MVVM en las vistas

Las páginas de UI se dividen en tres archivos: `XPage.view.js` (JSX puro), `XPage.viewModel.js` (estado y handlers, usa hooks sobre los `services/`), `XPage.model.js` (shape de datos). El `viewModel` es quien llama a `services/` (no a la capa `domain`), gestiona el `useState`/`useEffect` y expone handlers a la vista.

### Build, test y lint

- Build en dos pasos: `domain` se compila primero (TypeScript → `lib/`), luego Next.js.
- Tests con Jest, `NODE_OPTIONS=--experimental-vm-modules` para soportar ESM.
- Lint/formato centralizados con `@s-ui/lint` (eslint + prettier + stylelint compartidos).
- Sin `vercel.json`: despliegue "zero-config" en Vercel, autodetectado como proyecto Next.js.

### Cómo se traduce esto a Baco-Fit

Baco-Fit es mucho más pequeño (un endpoint de escritura, cuatro vistas de lectura), así que replicar el patrón completo tal cual sería sobre-ingeniería en algunos puntos. Se propone adoptar:

- **Sí, desde el principio**: la separación en capas `domain/models`, `application/<caso de uso>`, `repositories/` dentro de una carpeta `domain/` del propio repo (no hace falta que sea un workspace npm independiente al no haber un segundo consumidor del paquete). Casos de uso previstos: `AddEntriesUseCase`, `GetDailySummaryUseCase`, `GetHistoryUseCase`, `GetUserGoalUseCase`, `SetUserGoalUseCase`.
- **Sí, desde el principio**: rutas de `app/api/.../route.ts` finas, que solo resuelven un caso de uso y devuelven `NextResponse.json`, igual que el ejemplo de `expenses`.
- **Sí, desde el principio**: un repositorio dedicado por entidad de ElectroDB (`CalorieEntryRepository`, `UserConfigRepository`) como única capa que conoce el `schema` de ElectroDB — equivalente a `ExpenseRepository`/`DbAdapterFactory`.
- **A valorar más adelante, no de entrada**: el contenedor de `inversify` + `di.ts`/`types.ts`. Con 4-5 casos de uso y un solo consumidor (las propias rutas de Next.js), instanciar los casos de uso directamente (`new AddEntriesUseCase(new CalorieEntryRepository())`) es más simple y sigue permitiendo swap de implementación en tests. Se puede introducir `inversify` el día que el número de casos de uso/repositorios crezca lo suficiente para que la inyección manual se vuelva incómoda.
- **No aplica todavía**: el patrón MVVM de vistas y los workspaces npm separados (`domain`/`services` como paquetes independientes), porque Baco-Fit no tiene (de momento) formularios complejos de UI ni un segundo consumidor del dominio fuera de la propia app.

## 6ter. Fuera de alcance de esta arquitectura

- Separación de entornos (dev/prod): una única tabla, un único entorno.
- Índices secundarios (GSI/LSI): no son necesarios con el diseño de SK propuesto.
- Infraestructura como código (Terraform/CDK) para crear la tabla DynamoDB: se asume creación manual, igual que previsiblemente se hizo para `expenses`/`guests`.
- Estrategia de backup/retención de datos.
