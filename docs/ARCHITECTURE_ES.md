# Documentación Arquitectónica de TeraSpot

## 1. Introducción y Visión Estratégica

TeraSpot es una solución integral de Estacionamiento Inteligente basada en eventos, diseñada para cerrar la brecha entre la infraestructura física y las experiencias digitales del usuario. Al converger la Computación en el Borde (Edge Computing o Fog), la Nube Serverless e Interfaces Móviles/Web Multiplataforma, el sistema resuelve el problema de la movilidad urbana. Transforma transmisiones de video estándar en datos de ocupación procesables en menos de un segundo, democratizando la disponibilidad de estacionamiento para los conductores y ofreciendo un control granular a los administradores de las instalaciones.

La filosofía central de TeraSpot es "Procesar Localmente, Analizar Globalmente, Visualizar Instantáneamente".

*   **Procesar Localmente**: La inferencia pesada de visión por computadora ocurre en el borde de la red para preservar la privacidad y el ancho de banda.
*   **Analizar Globalmente**: Una nube serverless agrega datos para identificar tendencias históricas y realizar enrutamiento en tiempo real.
*   **Visualizar Instantáneamente**: Un ecosistema frontend unificado entrega actualizaciones en vivo a los usuarios en cualquier dispositivo (Web, iOS, Android) con una latencia insignificante.

### 1.1. Estrategia de Hardware: Paridad de Producción vía Contenedorización

Una característica definitoria de la arquitectura TeraSpot es su agnosticismo de hardware, logrado a través de una rigurosa contenedorización. Esto permite que el sistema permanezca flexible entre hardware de producción de alto rendimiento y simulación en la nube escalable.

*   **El Objetivo de Producción (NVIDIA Jetson)**: El núcleo del software está diseñado para dispositivos NVIDIA Jetson (series Nano/Orin). En un despliegue del mundo real, estos dispositivos aprovechan los núcleos CUDA integrados para acelerar los modelos de visión por computadora YOLO11. Esta elección de hardware permite inferencia de alta velocidad de fotogramas directamente en el estacionamiento, asegurando que las imágenes de video sin procesar nunca necesiten salir de la red local, satisfaciendo así regulaciones estrictas de privacidad (GDPR/CCPA).

*   **El Modelo de Demostración (Simulación EC2)**: Con el propósito de esta demostración arquitectónica y pruebas escalables, el Nodo Edge físico es simulado (mocked) utilizando una Instancia AWS EC2.

    *   **Paridad de Arquitectura**: Debido a que la aplicación Fog está completamente contenedorizada vía Docker, la instancia EC2 ejecuta exactamente el mismo código fuente, lógica de visión y protocolos de comunicación que el hardware físico Jetson.
    *   **Validación**: Este enfoque prueba la portabilidad de la solución, validando que la pila de software funciona idénticamente ya sea que se ejecute en hardware embebido ARM64 o infraestructura en la nube x86_64.

### 1.2. Pilares Arquitectónicos

El sistema está construido sobre cuatro pilares técnicamente distintos pero altamente integrados:

**I. La Capa Fog (Borde Inteligente)**
En lugar de simplemente grabar video, la capa Fog lo "observa" e interpreta. Ejecutándose dentro de un contenedor Docker, utiliza:

*   **Procesamiento en Ráfaga**: Analiza grupos de fotogramas (por ejemplo, 5 a la vez) para conservar energía.
*   **Reducción de Ruido**: Implementa un algoritmo de "Voto Mayoritario" para filtrar fantasmas transitorios (por ejemplo, un pájaro volando frente a una cámara) y prevenir falsos positivos.
*   **Mapeo Geométrico**: Utiliza Ray Casting (Lanzamiento de Rayos) para mapear vehículos detectados (cajas delimitadoras) a polígonos de estacionamiento específicos definidos por el usuario (ROIs), permitiendo formas de estacionamiento irregulares.

**II. El Backend Serverless (Nube Basada en Eventos)**
La infraestructura en la nube es totalmente serverless, basándose en AWS Lambda y DynamoDB. Evita el diseño monolítico por un enfoque reactivo de microservicios:

*   **Sin Sondeos (No Polling)**: Los datos fluyen reactivamente. Ingesta MQTT -> Actualización de Base de Datos -> Procesamiento de Flujo -> Transmisión WebSocket.
*   **Gestión de Estado**: Mantiene un estado "Caliente" (ocupación actual) para la aplicación y un estado "Frío" (registros históricos) para análisis, escalando automáticamente de cero a miles de eventos concurrentes.

**III. La Capa de Presentación Unificada (Monorepo Frontend)**
La interfaz de usuario no es meramente una colección de aplicaciones, sino un Monorepo cohesivo construido con Turborepo y Expo (React Native). Esta arquitectura permite a TeraSpot desplegar aplicaciones nativas iOS, nativas Android y Web responsivas desde una única base de código TypeScript.

*   **Inteligencia Compartida**: La lógica de negocio (`@repo/core`) y los Sistemas de Diseño (`@repo/ui`) se comparten entre las aplicaciones de Cliente y Admin, asegurando que una definición de tipo de API cambiada en el backend se refleje instantáneamente en todas las interfaces de usuario.
*   **Acceso Basado en Roles**: El sistema soporta dos personas de usuario distintas (Usuario y admin) con aplicaciones estrictamente separadas pero con una lógica subyacente unificada.

**IV. DevOps y Confiabilidad (CI/CD)**
TeraSpot está respaldado por una robusta tubería de entrega automatizada usando GitHub Actions, asegurando que la "Simulación" coincida con los estándares de calidad de "Producción":

*   **CI del Backend**: Una puerta de enlace "Test-First" (Prueba Primero) que ejecuta `pytest` con `moto` (simulación de AWS) en cada commit.
*   **Despliegue Automatizado**: El código solo se envía al entorno AWS en vivo después de pasar todas las pruebas unitarias.
*   **Actualizaciones OTA**: El software Fog se construye y envía automáticamente a Amazon ECR, permitiendo que los dispositivos Edge obtengan actualizaciones Over-The-Air (por aire).

### 1.3. Detalles del Ecosistema de Aplicaciones

La capa frontend es la manifestación visual de las capacidades en tiempo real del sistema. Se divide en dos aplicaciones especializadas:

*   **La App Cliente (Experiencia del Conductor)**:
    *   **Objetivo**: Estacionamiento sin fricción.
    *   **Tecnología**: Utiliza WebSockets para suscribirse al backend. Cuando un auto entra en un espacio, el backend envía una carga útil (payload), y la app actualiza el mapa de Verde a Rojo en menos de 1 segundo.
    *   **Acceso**: Uso anónimo para reducir la barrera de entrada para los conductores.

*   **El Panel de Administración (Experiencia del Gerente)**:
    *   **Objetivo**: Control y Configuración.
    *   **Tecnología**: Asegurado vía Amazon Cognito. Esta app incluye un Editor de ROI sofisticado, un lienzo interactivo que se superpone a los cuadros de la cámara en vivo, permitiendo a los gerentes "dibujar" espacios de estacionamiento. Estos dibujos se serializan en JSON, se envían a la API y se empujan a los dispositivos Edge para actualizar su lógica de detección dinámicamente.

---

## 2. Infraestructura y DevOps

Mientras que la capa Fog maneja la visión y el Backend gestiona la lógica, el módulo de Infraestructura proporciona la base sobre la cual descansa todo el sistema TeraSpot. Nos adherimos estrictamente a los principios de Infraestructura como Código (IaC), asegurando que todo el entorno en la nube tenga control de versiones, sea reproducible y transparente.

### 2.1. La Estrategia de Gestión Híbrida

Una decisión arquitectónica central en TeraSpot es la separación del Aprovisionamiento de Infraestructura del Despliegue de Aplicaciones. Utilizamos un enfoque híbrido para gestionar el ciclo de vida de los recursos de AWS:

*   **Terraform (Aprovisionamiento)**:
    *   **Responsabilidad**: Aprovisiona los recursos de nube de larga duración. Esto incluye crear funciones Lambda vacías, definir esquemas de tablas DynamoDB, configurar rutas de API Gateway y establecer roles IAM.
    *   **¿Por qué?**: Terraform es excelente gestionando el estado y las dependencias (por ejemplo, asegurar que un Rol exista antes de que una Función intente usarlo).

*   **GitHub Actions (Despliegue)**:
    *   **Responsabilidad**: Inyecta el código real de la aplicación (Python/Docker) en los recursos creados por Terraform.
    *   **¿Por qué?**: Vincular el despliegue de código a Terraform puede ser lento y engorroso. Al desacoplarlos, logramos ciclos de CI/CD rápidos e iterativos sin arriesgar la desviación de la infraestructura (infrastructure drift).

### 2.2. Implementación de Terraform

Ubicada en `infrastructure/terraform/`, nuestra configuración de Terraform es la "fuente de la verdad" para el entorno de AWS.

#### 2.2.1. El Flujo de Trabajo
La gestión de la infraestructura sigue un estricto ciclo de vida de tres pasos:

1.  **Inicialización**:
    *   Terraform descarga los plugins necesarios del Proveedor AWS.
    *   Inicializa el Backend de Estado. Para este proyecto, utilizamos un Estado Local (`terraform.tfstate`) rastreado en git.

2.  **Planificación**:
    *   Terraform compara el estado actual de la cuenta AWS en vivo contra los archivos `.tf` definidos.
    *   Genera un "Plan" detallando exactamente qué será creado, modificado o destruido.

3.  **Aplicación**:
    *   Terraform ejecuta el plan contra la API de AWS.
    *   **Inyección de Configuración**: Esta es la etapa donde las Variables de Entorno se inyectan en las funciones Lambda. Si la función `ingest_status` necesita saber el nombre de la tabla DynamoDB, esa variable se define aquí en HCL.

#### 2.2.2. Gestión del Estado
El archivo `terraform.tfstate` es el cerebro de nuestra infraestructura. Mapea los nombres de recursos abstractos en nuestro código a los IDs de Recursos AWS reales.
*   **Restricción Crítica**: La modificación manual de recursos AWS vía la Consola AWS está estrictamente prohibida ("ClickOps").

### 2.3. Inventario de Recursos

El módulo de Infraestructura aprovisiona recursos a través de cuatro categorías distintas.

**I. Computación (AWS Lambda e IAM)**
Terraform aprovisiona el entorno de ejecución para nuestros microservicios.
*   **Armazones de Función (Function Shells)**: Crea las funciones Lambda con código ficticio inicialmente.
*   **Roles IAM**: Genera políticas de "Mínimo Privilegio".
*   **Variables de Entorno**: Inyectadas por Terraform (ej. `DYNAMODB_TABLE`).

**II. Almacenamiento (DynamoDB y S3)**
*   **Tablas DynamoDB**:
    *   `parking-spaces-dev` (Caliente): Habilitado para DynamoDB Streams.
    *   `parking-history` (Frío): Auditoría a largo plazo.
*   **Buckets S3**:
    *   `teraspot-config-dev`: Repositorio centralizado para activos de configuración.

**III. Redes (API Gateway)**
Terraform construye la `teraspot-api`, sirviendo como punto de entrada unificado.
*   **Mapeo de Rutas**: `GET /status`, `POST /config`, etc.
*   **CORS**: Configurado para permitir acceso desde el frontend web.

**IV. Infraestructura de Simulación (EC2)**
Para facilitar la arquitectura de "Edge Simulado", Terraform aprovisiona una instancia EC2 específica (`ec2_camera.tf`).
*   **User Data Bootstrap**: Script que actualiza el SO, instala Docker y AWS CLI, y lanza los contenedores de simulación.

---

## 3. Computación en la Niebla (Fog Computing)

La Capa Fog es el órgano sensorial del sistema TeraSpot. Reside físicamente en la instalación de estacionamiento, actuando como el puente entre el mundo analógico y el digital.
Los nodos Fog de TeraSpot realizan **Computación Pesada** localmente, analizando video y transmitiendo solo metadatos ligeros.

### 3.1. Lógica Central y Visión por Computadora

La lógica se ejecuta dentro de un contenedor Docker (`teraspot-fog`).

**I. El Motor de Inferencia (`yolo_processor.py`)**
Utiliza **Ultralytics YOLO11n**, optimizado para velocidad en dispositivos embebidos.
*   **Filtrado de Clases**: Filtramos estrictamente a clases relevantes (Auto, Moto, Autobús, Camión).
*   **Estrategia de Procesamiento en Ráfaga**:
    1.  **Despertar (Wake)**: Captura 5 cuadros.
    2.  **Procesar (Process)**: Inferencia rápida.
    3.  **Dormir (Sleep)**: Reposo para conservar energía.

**II. Mapeo Espacial**
Detectar un "Auto" no es suficiente; necesitamos saber qué espacio ocupa.
*   **Configuración de ROI**: Archivo `config.json` con polígonos.
*   **Algoritmo de Lanzamiento de Rayos (Ray Casting)**: Determina si el centroide del vehículo está dentro de un polígono de estacionamiento.

**III. Reducción de Ruido**
*   **Voto Mayoritario**: Un espacio se declara OCUPADO solo si se detectaron vehículos en él durante >50% de los cuadros en la ráfaga actual (3 de 5).

### 3.2. Hardware y Despliegue

*   **Objetivo de Producción**: **NVIDIA Jetson (Nano / Orin)**. Detecta GPU y usa TensorRT/CUDA.
*   **Objetivo de Simulación**: **AWS EC2**. Contenedor Docker idéntico.
*   **Contenedorización**: `teraspot-fog` imagen Docker con todas las dependencias (PyTorch, OpenCV).
*   **Configuración**: Stateless, vía Variables de Entorno (`AWS_IOT_THING_NAME`, etc.).

### 3.3. Comunicación y Seguridad

**I. Conectividad (MQTT)**
*   **Telemetría**: `teraspot/status/{facility_id}/{zone_id}`.
*   **Comando**: `teraspot/cmd/{device_id}`.

**II. Seguridad (mTLS)**
*   Certificados X.509 y Clave Privada en el dispositivo. No passwords.

**III. Resiliencia (LWT)**
*   Uso de **Last Will and Testament** de MQTT para detectar desconexiones abruptas ("Offline").

### 3.4. Configuración Remota y Actualizaciones

*   **Sincronización de Configuración**: Descarga definiciones de ROI desde S3/API al inicio.
*   **Actualizaciones Por el Aire (OTA)**: GitHub Actions construye y envía nuevas imágenes a ECR.

---

## 4. Backend Serverless

El Backend actúa como el sistema nervioso central, arquitectado en AWS Serverless (Lambda, DynamoDB).

### 4.1. Principios Arquitectónicos
*   **Ejecución Basada en Eventos**: Sin polling.
*   **Computación Sin Estado (Stateless)**: Todo estado persiste en DynamoDB.
*   **Aislamiento de Procesos**: Microservicios independientes.

### 4.2. Catálogo de Microservicios

**I. Tubería de Ingesta**
*   `ingest_status`: Recibe telemetría MQTT. Maneja LWT y persiste a DynamoDB.

**II. Motor Reactivo**
*   `analytics_notifier`:
    *   Disparado por DynamoDB Stream.
    *   Compara `NewImage` vs `OldImage`.
    *   Transmite cambios vía WebSockets.
    *   Monitoreo programado (EventBridge) para detectar sensores muertos.

**III. Superficie de la API (REST)**
*   `read_status` (GET): Instantánea inicial.
*   `kpi_monitor` (POST): Inteligencia de Negocios (Ocupación, Tiempo de Permanencia).
*   `config_saver` (POST): Guarda nuevas definiciones de ROI en S3.
*   `device_command` (POST): Envía comandos MQTT (Reload/Snapshot) al borde.

**IV. Gestión de WebSockets**
*   `ws_connect` / `ws_disconnect`: Gestiona tabla de conexiones para transmisiones en tiempo real.

### 4.3. Código Compartido y Librerías (`backend/shared/`)
*   `dlq_handler.py`: Manejo de errores (SQS DLQ).
*   `constants.py`: Literales para evitar "cadenas mágicas".
*   `dynamodb_models.py`: Definiciones Pydantic compartidas.

### 4.4. Gestión de Dependencias
Evitamos un `requirements.txt` monolítico. Cada función tiene su propio `requirements.txt`.
*(Nota técnica: kpi_monitor está diseñado para cálculos analíticos, aunque actualmente puede no requerir numpy si los cálculos son simples).*

### 4.5. Estrategia de Pruebas
*   **Mocking con moto**: AWS simulado para pruebas unitarias rápidas y gratuitas.
*   **Inyección de Fixtures**: Simulación de variables de entorno con `pytest`.

---

## 5. Capa de Presentación Frontend

Monorepo con Turborepo y Expo (React Native).

### 5.1. Pila Tecnológica
*   **Framework**: Expo (React Native) para iOS, Android y Web.
*   **Lenguaje**: TypeScript.
*   **Enrutamiento**: Expo Router.
*   **Estado**: React Query y Context.

### 5.2. Librerías Compartidas
*   `@repo/ui`: Componentes "tontos" (Button, Card). Platform-agnostic.
*   `@repo/core`: Lógica de negocio, Cliente API, Tipos TypeScript.

### 5.3. Apps
*   **App Cliente**: Acceso anónimo, Time-Real (WebSockets), Mapa/Lista.
*   **Panel de Administración**: Autenticación Cognito, Editor de ROI (Lienzo interactivo), Gráficos de KPI.

### 5.4. Flujo de Trabajo
*   Gestado con `pnpm`.
*   Ejecución local simultánea de ambas apps.

---

## 6. Interacciones del Sistema y Flujo de Datos

### 6.1. La Utilización en Tiempo Real ("Hot Path")
1.  **Origen**: Fog detecta vehículo -> MQTT.
2.  **Ingesta**: IoT Core -> `ingest_status` -> DynamoDB.
3.  **Reacción**: DynamoDB Stream -> `analytics_notifier` -> WebSocket API.
4.  **Entrega**: Notificación al celular del usuario (< 1s).

### 6.2. Configuración Remota ("Control Path")
1.  **Acción**: Admin dibuja polígono -> `config_saver`.
2.  **Almacenamiento**: JSON a S3.
3.  **Señal**: `device_command` envía comando "RELOAD" MQTT.
4.  **Sincronización**: Fog descarga nuevo JSON y actualiza lógica.

### 6.3. Analíticas ("Insight Path")
*   **Pull**: Admin pide KPIs -> `kpi_monitor` consulta historial.
*   **Push**: `analytics_notifier` detecta lote lleno -> SNS Alerta.

### 6.4. Despliegue ("Deployment Path")
*   **Backend**: GitHub Actions -> AWS Lambda (Hot-swap).
*   **Fog**: GitHub Actions -> Amazon ECR -> OTA Pull.
