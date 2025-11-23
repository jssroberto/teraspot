**Avance 02:** Funcionamiento del Sistema

**Nombre del Proyecto:** TeraSpot

**Equipo:**

Jose Karim Franco Valencia

Jose Luis Madero López

Eliana Monge Cámara

Jesús Roberto García Armenta

**Introducción**

Este segundo avance describe la arquitectura funcional del sistema TeraSpot, enfocándose en los mecanismos de recepción de datos, aseguramiento de calidad, almacenamiento temporal y emisión de notificaciones, cumpliendo con los requerimientos definidos para la etapa de integración.  
El sistema ya no se limita a la definición conceptual del proyecto, sino que ahora se presenta el flujo operativo completo, desde la generación de datos en los nodos de niebla hasta su procesamiento y reacción dentro de la nube.

**Arquitectura General del Sistema**

La arquitectura continúa basándose en el modelo híbrido Niebla–Nube (Fog/Cloud), manteniendo los principios de procesamiento local, comunicación ligera y servicios gestionados en la nube.

**El flujo de información sigue las siguientes etapas:**

**Procesamiento local en niebla (Fog Layer):**  
Los nodos de cómputo con IA (instancias EC2 con GPU o dispositivos Jetson) analizan en tiempo real los flujos de video para determinar la ocupación de cada espacio.  
Cuando un estado cambia (de “libre” a “ocupado” o viceversa), se genera un mensaje JSON con la información mínima necesaria.

**Transmisión mediante MQTT:**  
El mensaje se publica en un topic de AWS IoT Core, actuando como broker MQTT.  
Se utiliza QoS 1 para garantizar entrega, cifrado TLS 1.2+ y autenticación mediante certificados X.509.  
**Ejemplo de mensaje:**  
![][image1]

**Procesamiento y aseguramiento de calidad (Quality Assurance Layer):**  
 Los mensajes recibidos por IoT Core activan una función de AWS Lambda, que implementa un componente de aseguramiento de calidad antes de permitir el almacenamiento.  
 Este módulo aplica las siguientes validaciones:

* **Verificación de formato JSON** y presencia de campos requeridos.

* **Control de duplicados:** se descartan eventos repetidos dentro de una ventana de 3 segundos para el mismo `space_id`.

* **Validación estadística de confianza:** si `confidence < 0.75`, el evento se marca como “inseguro” y se reenvía a una cola SQS de revisión.

* **Filtrado temporal:** se comprueba que el `timestamp` no sea anterior al último evento registrado.

Solo los datos que cumplen con los criterios de calidad continúan al flujo principal.

**Almacenamiento en base de datos de series temporales (Data Storage Layer):**

* Los datos validados se guardan en **Amazon Timestream**, que permite registrar y consultar series temporales de ocupación.

* En paralelo, se actualiza **DynamoDB**, que conserva el estado actual de cada espacio.

* Esta combinación permite consultas de estado inmediato y análisis histórico a largo plazo.


**Emisión de notificaciones (Notification Layer):**  
 Los cambios registrados en DynamoDB generan eventos en **DynamoDB Streams**, los cuales disparan otra función **Lambda** dedicada a la detección de condiciones críticas.  
 Ejemplos de reglas:

* **Ocupación total \> 95 %** → notificar al administrador vía **SNS (correo electrónico o app)**.

* **Sensores sin actualización \> 5 min** → enviar alerta de dispositivo inactivo.

* **Nuevo espacio liberado** → emitir actualización instantánea por **WebSocket (API Gateway WSS)** al panel de usuarios.

Este mecanismo garantiza comunicación proactiva tanto hacia administradores como hacia usuarios finales.

### **Descripción de los Componentes Funcionales**

#### **Recepción de Datos (MQTT Broker – AWS IoT Core)**

* Actúa como punto central de entrada para todos los datos de ocupación.

* Soporta millones de conexiones simultáneas.

* Cada dispositivo tiene un *topic* único de publicación, estructurado como:  
   `teraspot/{facility_id}/{zone_id}/{device_id}/status`

* Permite comunicación bidireccional para actualizaciones o comandos desde la nube.

#### **Aseguramiento de Calidad**

* Implementado en **AWS Lambda** con Python.

* Verifica integridad, coherencia y confiabilidad de los datos antes de ser almacenados.

* Los eventos anómalos se redirigen a **Amazon SQS (Dead-Letter Queue)** para su análisis.

* Este componente garantiza que las métricas en la nube sean precisas y confiables.

#### **Almacenamiento de Series Temporales**

* **Amazon Timestream** guarda el historial de cambios de cada espacio con marcas de tiempo.

| Término (Timestream) | Nombre del Campo | Tipo de Dato | Ejemplo (de la imagen) | Descripción |
| :---- | :---- | :---- | :---- | :---- |
| **Dimensión** | space\_id | varchar | "A-04" | Identificador único del espacio monitoreado. |
| **Dimensión** | device\_id | varchar | "teraspot-ed..." | ID del nodo de niebla o dispositivo que envía el dato. |
| **Medida** | status | varchar | "occupied" | Estado detectado ("occupied" o "vacant"). |
| **Medida** | confidence | double | 0.915 | Nivel de confianza (0.0-1.0) de la detección de IA. |
| **Medida** | (Otros) | (Según aplique) | ... | (Ej. facility\_id, zone\_id si también los guardas) |
| **Tiempo** | time | timestamp | (Columna 5\) | Marca de tiempo del evento de detección. |

  

* Soporta consultas agregadas, tendencias y análisis predictivo (ej. horas pico, tiempo promedio de estancia).

* **Amazon DynamoDB** mantiene el estado actual, asegurando respuestas instantáneas para la interfaz web.

| Término (DynamoDB) | Nombre del Campo | Tipo de Dato | Ejemplo | Descripción |
| :---- | :---- | :---- | :---- | :---- |
| **Partition Key (PK)** | space\_id | String | "A-04" | Identificador único del espacio. |
| Atributo | status | String | "occupied" | El último estado reportado. |
| Atributo | confidence | Number | 0.915 | La última confianza reportada. |
| Atributo | last\_updated | String (ISO 8601\) | "2025-11-03T23:00:00Z" | Timestamp del último cambio. |
| Atributo | device\_id | String | "teraspot-ed..." | Último dispositivo que reportó. |

#### **Notificaciones y Comunicación en Tiempo Real**

* **Amazon SNS** gestiona alertas críticas hacia correos o aplicaciones móviles.

* **API Gateway (WebSocket)** envía actualizaciones directas a los clientes web para mostrar cambios de ocupación en vivo.

* Este mecanismo mantiene informados a los usuarios y reduce tiempos de reacción.

#### **Diagrama de Componentes**

La arquitectura del sistema es multifacética e involucra varios flujos de trabajo distintos. Para facilitar su comprensión, la arquitectura de componentes se presenta en dos niveles:

* Primero, se muestra un **diagrama general** que incluye todos los componentes y sus interacciones principales para ofrecer una vista panorámica.

* A continuación, se desglosa la arquitectura en **cuatro vistas específicas**, cada una enfocada en un flujo de trabajo clave del sistema, para analizar los detalles de cada proceso.

#### **Diagrama General de Componentes**

Este diagrama proporciona una vista completa de la interconexión de todos los servicios, desde el nodo de cómputo hasta el usuario final.

![][image2]

#### **Vistas Detalladas de la Arquitectura de Componentes**

A continuación, se presentan los diagramas que detallan los flujos más importantes del sistema.

**a) Flujo de Frontend y Autenticación**

Este diagrama se centra en la interacción del usuario final y el administrador con el sistema. Muestra cómo se realiza la autenticación a través de Amazon Cognito y cómo las aplicaciones frontend se comunican con el backend para obtener datos iniciales y recibir actualizaciones en tiempo real.

![][image3]

**b) Flujo de Configuración e Ingesta de Datos**

Ilustra dos procesos fundamentales: (1) cómo un administrador configura las áreas de interés (ROIs) y (2) el camino que sigue un evento de cambio de estado (ej. un auto se estaciona) desde el contenedor de procesamiento hasta que se almacena en la base de datos de estado (DynamoDB).

![][image4]

**c) Flujo de Procesamiento en el Nodo de Cómputo (Niebla)**

Esta vista se enfoca exclusivamente en la capa de niebla. Detalla las responsabilidades del nodo EC2 y sus contenedores: leer la configuración desde S3, analizar el video, y enviar los resultados (estado de ocupación) a AWS IoT Core vía MQTT.

![][image5]

**Diagrama de Despliegue**

El siguiente diagrama de despliegue UML ilustra cómo los componentes de software se asignan a la infraestructura de hardware y de nube.

![][image6]

**Descripción de los Nodos de Despliegue:**

* **User's Web Browser:** Nodo cliente que ejecuta las aplicaciones web de frontend. Se comunica con la nube vía HTTPS y WSS.

* **Physical Cameras:** Dispositivos físicos en el mundo real que capturan el video y lo transmiten al nodo de cómputo.

* **AWS Cloud (VPC):** Representa el entorno de nube privada virtual donde residen todos los recursos de AWS.

  * **EC2 GPU Instance:** Es el nodo de servidor virtual (hardware) que aloja el **Docker Engine**. Este motor, a su vez, despliega y ejecuta los múltiples **contenedores** de procesamiento de video. La instancia tiene un rol de IAM asociado que le otorga permisos para interactuar de forma segura con otros servicios de AWS. **Nota importante:** El diagrama de despliegue actual representa la arquitectura utilizada para el desarrollo y la demostración de este proyecto. En un escenario de producción real, este nodo EC2 GPU Instance sería reemplazado por uno o varios dispositivos físicos de borde, como el NVIDIA Jetson Nano, ubicados en las instalaciones de

### 

### **Flujo General de Datos**

1. Nodo de niebla detecta cambio de estado.

2. Publica evento MQTT a AWS IoT Core.

3. IoT Core activa Lambda de aseguramiento de calidad.

4. Si es válido, se almacena en DynamoDB y Timestream.

5. DynamoDB Streams dispara Lambda de notificaciones.

6. SNS o WebSocket distribuyen las alertas.

7. El usuario ve la actualización en tiempo real en la aplicación web.

### **Conclusión**

El sistema **TeraSpot**, en esta fase de implementación, demuestra una integración completa entre los componentes de niebla y nube mediante un flujo de datos confiable y escalable.  
 La recepción segura por MQTT, el control de calidad automatizado, el almacenamiento temporal optimizado y el sistema de notificaciones reactivo consolidan una plataforma funcional que cumple los principios de un ecosistema IoT moderno.