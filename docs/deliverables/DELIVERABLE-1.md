## **Avance 1: Definición del Proyecto Final de IoT**

**Nombre del Proyecto:** TeraSpot

**Equipo:** 

Jose Karim Franco Valencia

Jose Luis Madero 

Eliana Monge Cámara

Jesús Roberto García Armenta

### **1\. Definición del Propósito General del Proyecto**

El propósito de este proyecto es diseñar y desarrollar una solución integral y nativa de la nube para resolver el persistente desafío urbano de la gestión ineficiente de estacionamientos. El sistema, denominado "TeraSpot", utiliza visión por computadora en tiempo real, una arquitectura híbrida de niebla/nube y un backend completamente *serverless* para transformar el video de cámaras de seguridad convencionales en una red de sensores de ocupación inteligentes.

El objetivo principal es doble:

1. **Para los operadores de estacionamientos:** Proporcionar datos precisos y accionables en tiempo real para optimizar la gestión de espacios, mejorar la asignación de recursos y abrir nuevas oportunidades de ingresos (ej. precios dinámicos).

2. **Para los conductores:** Ofrecer una experiencia fluida y sin frustraciones, permitiéndoles identificar rápidamente los espacios disponibles, lo que reduce el tiempo de búsqueda, el consumo de combustible y las emisiones de carbono asociadas.

Este proyecto aborda las limitaciones de las soluciones tradicionales (como sensores magnéticos costosos o patrullas manuales ineficientes) mediante un enfoque moderno, escalable, seguro y rentable, sentando las bases para futuras iniciativas de Ciudades Inteligentes (Smart Cities).

### **2\. Descripción de los Elementos de Nube y de Niebla**

A continuación, se describen los componentes de la arquitectura distribuidos en las capas de nube y de niebla.

#### **2.1 Elementos de Nube (Cloud)**

El backend del sistema está construido enteramente sobre servicios gestionados y serverless de Amazon Web Services (AWS), lo que garantiza alta disponibilidad, escalabilidad automática y un modelo de costos basado en el uso. Los elementos de nube son:

* **AWS IoT Core**: Funciona como broker MQTT centralizado para toda la comunicación edge-to-cloud. Los dispositivos de niebla publican actualizaciones de estado de estacionamiento mediante MQTT con QoS 1 (garantía de entrega), utilizando autenticación basada en certificados X.509 para máxima seguridad. Las reglas de IoT Core enrutan automáticamente los mensajes a las funciones Lambda correspondientes, eliminando la necesidad de API Gateway para la ingesta de datos desde dispositivos edge.

* **API Gateway**: Expone únicamente una API WebSocket (WSS) para enviar actualizaciones en tiempo real a los clientes web. Gestiona la autorización de acceso mediante Cognito para los usuarios finales. La API REST para ingesta de datos ha sido reemplazada por comunicación MQTT a través de AWS IoT Core, simplificando la arquitectura.

* **AWS Lambda**: Proporciona la lógica de cómputo sin servidor. Se utilizan funciones para procesar las actualizaciones de estado recibidas vía IoT Core, leer el estado actual de los espacios, guardar configuraciones y analizar los flujos de datos que provienen de la base de datos.

* **Amazon DynamoDB**: Es una base de datos NoSQL gestionada que funciona como la fuente de verdad única para el estado actual de cada espacio de estacionamiento. Su alta velocidad y escalabilidad son ideales para esta aplicación.

* **DynamoDB Streams**: Captura todas las modificaciones en la tabla de DynamoDB en una secuencia ordenada por tiempo. Cada actualización genera un evento que activa una función Lambda para análisis posterior, implementando así una arquitectura orientada a eventos.

* **Amazon Timestream**: Es una base de datos de series temporales donde se almacena el historial de cada cambio de ocupación (ej. espacio A-01 pasó a "ocupado" en el timestamp X). Esto permite realizar análisis de tendencias a largo plazo.

* **Amazon S3**: Se utiliza para almacenar los activos estáticos de las aplicaciones web (HTML, CSS, JS) y los archivos de configuración (JSON) que definen las áreas de interés (ROI \- Region of Interest) para cada cámara.

* **Amazon Cognito**: Gestiona la autenticación y autorización de usuarios, proveyendo un sistema seguro de registro, inicio de sesión y gestión de sesiones para los usuarios que acceden a los paneles de visualización.

* **Amazon SQS y SNS**: Para robustez, se usa una cola de mensajes no entregados (SQS Dead-Letter Queue) para capturar eventos que fallen en el procesamiento, evitando la pérdida de datos. SNS se utiliza para enviar notificaciones a los administradores sobre eventos críticos.

#### **2.2 Elementos de Niebla (Fog)**

La capa de niebla (Fog Computing) tiene la responsabilidad de realizar el procesamiento pesado de datos cerca de su origen (las cámaras) para minimizar la latencia y el costo de ancho de banda hacia la nube. En este proyecto, se implementa de la siguiente manera:

* **Nodo de Cómputo con IA (Instancia EC2 con GPU)**: Para la fase de desarrollo y demostración académica, se utiliza una instancia de Amazon EC2 tipo **g4dn.xlarge** con GPU NVIDIA T4. Esta instancia simula el comportamiento de **un único dispositivo edge** procesando 4-6 cámaras, replicando las capacidades de un NVIDIA Jetson Orin Nano en condiciones reales. Es importante destacar que esta instancia en la nube simula el comportamiento del hardware que se usaría en un entorno real.

  **Justificación del uso de EC2**: Se eligió g4dn.xlarge como la opción más económica de instancias GPU en AWS ($0.526/hora en on-demand, \~$0.157/hora en spot instances). Aunque tiene mayor capacidad que un Jetson Orin Nano, se configurará con límites de recursos (8GB memoria, procesamiento de 4-6 cámaras máximo) para simular fielmente el comportamiento del dispositivo de producción.

* **Contenedores Docker**: La lógica de análisis de video está empaquetada en un contenedor Docker que simula un dispositivo Jetson individual. El contenedor es responsable de procesar los flujos de video de sus cámaras asignadas. Esto hace que la solución sea modular, escalable y fácil de desplegar.

* **Modelo de IA (YOLO11s)**: Dentro del contenedor se ejecuta el modelo **YOLO11s** (small variant) optimizado específicamente para detección de vehículos en espacios de estacionamiento. Este modelo fue seleccionado por alcanzar **96.7% mAP50** en escenarios de parking detection, superando a variantes más pequeñas en precisión mientras mantiene tiempos de inferencia de \~7ms en hardware Jetson. YOLO11s ofrece el balance óptimo entre precisión y eficiencia para este caso de uso.

* **Lógica de Procesamiento Local**: Un script de Python dentro del contenedor determina si un espacio cambia de estado (de vacante a ocupado o viceversa). Implementa **detección de cambios** para publicar actualizaciones únicamente cuando el estado de un espacio cambia, reduciendo el tráfico de red en más del 90% comparado con reportes periódicos.

* **Comunicación Eficiente vía MQTT**: La principal función de esta capa es procesar gigabytes de video y enviar a la nube únicamente los resultados: pequeños paquetes de datos JSON (ej. `{"space_id": "A-01", "status": "occupied", "timestamp": "2025-10-05T20:15:30Z"}`) mediante el protocolo **MQTT con QoS 1** a AWS IoT Core. El uso de MQTT proporciona:

  * **Escalabilidad superior**: Soporta millones de dispositivos concurrentes

  * **Menor overhead**: 12x menos ancho de banda que HTTP

  * **Conexiones persistentes**: Elimina handshakes repetidos

  * **Comunicación bidireccional**: Permite comandos desde la nube cuando sea necesario

Esto representa la esencia del Fog Computing: filtrar y procesar datos localmente antes de enviarlos a la nube.

### **3\. Propuesta Inicial de Arquitectura del Sistema**

#### **3.1 Análisis de Alternativas y Justificación de la Arquitectura**

Antes de decidir sobre la arquitectura final, se evaluaron varias alternativas conceptuales para abordar el problema. Cada una presentaba un conjunto de ventajas y desventajas que fueron cruciales para la decisión final.

**Alternativa 1: Sistema Basado en Sensores Ultrasónicos Individuales**

* **Descripción:** Consistía en instalar un sensor ultrasónico o magnético en cada cajón de estacionamiento. Cada sensor detectaría la presencia de un vehículo y enviaría una señal simple (ocupado/libre) a un concentrador central.

  * **Motivos para su Descarte:**

    * **Costo de Escalabilidad:** El costo de hardware se multiplica por el número de espacios, volviéndose prohibitivo para estacionamientos grandes.

    * **Instalación y Mantenimiento:** Requiere una instalación invasiva (perforar el pavimento o montar estructuras), con cableado complejo y un alto costo de mantenimiento, ya que los sensores están expuestos a daños por vehículos y condiciones climáticas.

    * **Inteligencia Limitada:** Solo proporciona un dato binario (sí/no). No permite funcionalidades futuras como reconocimiento de matrículas, análisis de tipo de vehículo o videovigilancia de seguridad.

  **Alternativa 2: Procesamiento de Video 100% en la Nube (AWS Rekognition)**

  * **Descripción:** Implicaba utilizar las cámaras existentes y transmitir continuamente el video a la nube para que un servicio gestionado como AWS Rekognition lo analizara.

  * **Motivos para su Descarte:**

    * **Costo Prohibitivo de Ancho de Banda:** La transmisión continua de múltiples flujos de video en alta definición a la nube generaría costos de transferencia de datos extremadamente altos.

    * **Dependencia de la Conexión:** El sistema completo fallaría si la conexión a internet del sitio se interrumpe. Constituye un punto único de falla crítico.

    * **Latencia:** El tiempo de ida y vuelta del video a la nube para su procesamiento podría introducir retrasos no deseados para aplicaciones en tiempo real.

    * **Costo del Servicio:** Los servicios de análisis de video en la nube cobran por minuto procesado, lo que resultaría en un costo operativo muy elevado para una vigilancia 24/7.

  **Alternativa 3: Servidor Centralizado Local (On-Premise)**

  * **Descripción:** Proponía instalar una única y potente PC o servidor en el estacionamiento, equipado con GPUs, para procesar todas las cámaras de forma centralizada.

  * **Motivos para su Descarte:**

    * **Punto Único de Falla:** Si este servidor central falla (por hardware, software o energía), todo el sistema de monitoreo se detiene por completo.

    * **Cuello de Botella de Rendimiento:** A medida que se añaden más cámaras, el servidor central se convierte en un cuello de botella, requiriendo un hardware cada vez más caro y complejo para mantener el rendimiento en tiempo real.

    * **Complejidad de Cableado:** Requiere una infraestructura de red local robusta para llevar todas las transmisiones de video a un único punto físico.

**La Elección de una Arquitectura Híbrida de Niebla/Borde (Fog/Edge)**

La arquitectura actual, basada en dispositivos de borde **(NVIDIA Jetson Nano)** y un backend en la nube, fue seleccionada porque resuelve las deficiencias de las alternativas anteriores. Este enfoque ofrece un balance óptimo:

* **Eficiencia:** Procesa el video localmente en los dispositivos Jetson, enviando a la nube solo los resultados (datos JSON de pocos bytes), lo que minimiza drásticamente los costos de ancho de banda.

* **Resiliencia:** Es un sistema distribuido. Si un dispositivo Jetson falla, solo se ven afectadas las pocas cámaras que gestiona; el resto del sistema sigue operativo.

* **Escalabilidad:** Se puede ampliar el sistema añadiendo más dispositivos Jetson de forma modular, sin crear un cuello de botella central.

* **Rentabilidad:** Aprovecha cámaras de seguridad existentes y utiliza dispositivos de borde de costo optimizado, ofreciendo la solución con el mejor balance entre costo, rendimiento y fiabilidad.


#### **3.2 Diagrama de Componentes**

La arquitectura del sistema es multifacética e involucra varios flujos de trabajo distintos. Para facilitar su comprensión, la arquitectura de componentes se presenta en dos niveles:

* Primero, se muestra un **diagrama general** que incluye todos los componentes y sus interacciones principales para ofrecer una vista panorámica.

* A continuación, se desglosa la arquitectura en **cuatro vistas específicas**, cada una enfocada en un flujo de trabajo clave del sistema, para analizar los detalles de cada proceso.

#### **Diagrama General de Componentes**

Este diagrama proporciona una vista completa de la interconexión de todos los servicios, desde el nodo de cómputo hasta el usuario final.

![][image1]

#### **Vistas Detalladas de la Arquitectura de Componentes**

A continuación, se presentan los diagramas que detallan los flujos más importantes del sistema.

**a) Flujo de Frontend y Autenticación**

Este diagrama se centra en la interacción del usuario final y el administrador con el sistema. Muestra cómo se realiza la autenticación a través de Amazon Cognito y cómo las aplicaciones frontend se comunican con el backend para obtener datos iniciales y recibir actualizaciones en tiempo real.

![][image2]

**b) Flujo de Configuración e Ingesta de Datos**

Ilustra dos procesos fundamentales: (1) cómo un administrador configura las áreas de interés (ROIs) y (2) el camino que sigue un evento de cambio de estado (ej. un auto se estaciona) desde el contenedor de procesamiento hasta que se almacena en la base de datos de estado (DynamoDB).

![][image3]

**c) Flujo de Procesamiento en el Nodo de Cómputo (Niebla)**

Esta vista se enfoca exclusivamente en la capa de niebla. Detalla las responsabilidades del nodo EC2 y sus contenedores: leer la configuración desde S3, analizar el video, y enviar los resultados (estado de ocupación) a AWS IoT Core vía MQTT.

![][image4]

**d) Flujo de Analítica y Notificaciones (Orientado a Eventos)**

Este diagrama muestra la arquitectura reactiva del backend. Comienza cuando un dato cambia en DynamoDB, lo que genera un evento en DynamoDB Streams. Este evento dispara una función Lambda que procesa los datos para análisis histórico (Timestream) y envía notificaciones a los administradores (SNS).

![][image5]

#### **Descripción de los Componentes:**

* **Frontend y Autenticación:**

  * **ROI Config UI:** Aplicación web para administradores que permite dibujar visualmente los espacios de estacionamiento sobre una imagen de la cámara y guardar la configuración.

  * **Parking Status Web App:** Aplicación web para usuarios finales que muestra el estado de ocupación del estacionamiento en tiempo real.

  * **Amazon Cognito:** Gestiona la identidad de los usuarios (Admin, End User).

* **Capa de Niebla (AI Compute Node):**

  * **EC2 Instance:** El nodo de hardware virtual donde reside la lógica de niebla.

  * **Processing Containers:** Componentes de software (contenedores Docker) que ejecutan el modelo de IA para analizar un flujo de video (`Video Streams`).

* **Backend (API, Lógica y Almacenamiento):**

  * **API Gateway:** Provee los puntos de entrada (endpoints) para la comunicación. Utiliza HTTPS para peticiones de estado y configuración, y WebSockets (WSS) para la comunicación en tiempo real con el frontend.

  * **Authorizers:** Sub-componentes que verifican la identidad, ya sea de un usuario (Cognito) o de un servicio (IAM), antes de permitir el acceso a la lógica del backend.

  * **Lambda Functions:** Unidades de código sin servidor que se ejecutan en respuesta a eventos. Cada una tiene una responsabilidad única: guardar configuración, ingerir datos de estado, leer el estado actual o procesar el flujo de eventos para análisis.

  * **DynamoDB:** Almacena el estado actual y es la fuente principal para la aplicación.

  * **DynamoDB Stream:** Componente que emite eventos cada vez que la tabla DynamoDB cambia.

  * **Amazon Timestream:** Base de datos para almacenar datos históricos para análisis.

  * **S3 Bucket:** Almacenamiento de objetos para los archivos del sitio web y las configuraciones.

* **Observabilidad, Mensajería y Manejo de Errores:**

  * **CloudWatch:** Recopila logs y métricas de todos los s

  * **SNS Topic:** Servicio de notificaciones para enviar alertas a los administradores.

  * **SQS Dead-Letter Queue:** Cola que almacena eventos de ingesta fallidos para su posterior análisis.

  * **AWS IoT Core:** Broker MQTT que recibe las actualizaciones de estado de estacionamiento desde los contenedores edge. Utiliza reglas IoT para enrutar los mensajes a las funciones Lambda correspondientes.

#### **3.2.1 Transición de Desarrollo a Producción**

#### **Arquitectura de Desarrollo (Actual)**

Para el desarrollo y demostración del proyecto académico, se utiliza:

* **Hardware**: Una instancia EC2 g4dn.xlarge con GPU NVIDIA T4

* **Configuración**: Un contenedor Docker simulando un dispositivo Jetson

* **Cámaras**: 4-6 fuentes de video (grabaciones o streams de prueba)

* **Ubicación**: Instancia EC2 ejecutándose en AWS (simulando edge)

#### **Arquitectura de Producción (Especificación)**

En un despliegue de producción real, cada nodo de cómputo sería:

* **Hardware**: NVIDIA Jetson Orin Nano Super ($249-299) o Jetson Orin NX ($599-799)

  * Capacidad: 20-40 espacios de estacionamiento por dispositivo

  * Consumo: 7-15W (vs 150W+ de servidores tradicionales)

  * Instalación: Física en las instalaciones del estacionamiento

* **Cámaras**: Cámaras IP estándar de 4MP ($50-80 cada una)

  * Conectividad: Power over Ethernet (PoE) para simplicidad de cableado

  * Cobertura: 1 cámara puede monitorear 20-40 espacios con ubicación óptima

  * No se requieren cámaras especializadas de parking (costo-efectivo)

* **Comunicación**: MQTT sobre TLS 1.2+ con certificados X.509

  * Protocolo idéntico entre desarrollo y producción

  * Autenticación mediante certificados de dispositivo (no credenciales IAM)

  * Topic structure: `teraspot/{facility_id}/{zone_id}/{device_id}/status`

#### **Ventajas del Enfoque Distribuido en Producción**

* **Resiliencia**: Si un Jetson falla, solo afecta su zona; el resto del sistema continúa operando

* **Eliminación de punto único de falla**: No existe servidor central cuya falla detenga todo el sistema

* **Reducción de ancho de banda**: Solo JSON ligero (\~1KB) viaja a la nube, no video (\~50MB/s)

* **Baja latencia**: Procesamiento local entrega resultados en \<10ms

* **Privacidad**: Las imágenes nunca salen del estacionamiento; solo metadata viaja a la nube

* **Escalabilidad lineal**: Agregar zonas simplemente requiere desplegar Jetsons adicionales

#### **Componentes que Permanecen Idénticos**

El código de inferencia YOLO11s, la lógica de detección de cambios, el cliente MQTT, la estructura de mensajes JSON y toda la infraestructura cloud de AWS se mantienen exactamente iguales entre desarrollo y producción, asegurando que la demostración académica representa fielmente el comportamiento del sistema real.

**3.3 Diagrama de Despliegue**

El siguiente diagrama de despliegue UML ilustra cómo los componentes de software se asignan a la infraestructura de hardware y de nube.

![][image6]

**Descripción de los Nodos de Despliegue:**

* **User's Web Browser:** Nodo cliente que ejecuta las aplicaciones web de frontend. Se comunica con la nube vía HTTPS y WSS.

* **Physical Cameras:** Dispositivos físicos en el mundo real que capturan el video y lo transmiten al nodo de cómputo.

* **AWS Cloud (VPC):** Representa el entorno de nube privada virtual donde residen todos los recursos de AWS.

  * **EC2 GPU Instance:** Es el nodo de servidor virtual (hardware) que aloja el **Docker Engine**. Este motor, a su vez, despliega y ejecuta los múltiples **contenedores** de procesamiento de video. La instancia tiene un rol de IAM asociado que le otorga permisos para interactuar de forma segura con otros servicios de AWS. **Nota importante:** El diagrama de despliegue actual representa la arquitectura utilizada para el desarrollo y la demostración de este proyecto. En un escenario de producción real, este nodo EC2 GPU Instance sería reemplazado por uno o varios dispositivos físicos de borde, como el NVIDIA Jetson Nano, ubicados en las instalaciones del estacionamiento.

  * **Managed & Serverless Services:** Este gran nodo representa los servicios de AWS que no requieren un servidor físico o virtual gestionado por el usuario. Los componentes de software (como las funciones Lambda, las tablas de DynamoDB, etc.) se despliegan directamente en la infraestructura gestionada de AWS. Por ejemplo, el código de las funciones Lambda se despliega en el servicio AWS Lambda, y los archivos del sitio web se despliegan en el servicio Amazon S3.