from lambda_function import lambda_handler

if __name__ == "__main__":
    import json

    # 1. DEFINIR EL EVENTO (Simulamos lo que enviaría el Frontend o API Gateway)
    # Ejemplo A: Pedir un KPI específico
    event_test_1 = {
        "kpi": "occupancy_rate",
        "params": {}
    }

    # Ejemplo B: Pedir todo el dashboard (lo que hace tu código con "all")
    event_test_2 = {
        "kpi": "all",
        "params": {
            "time_window_minutes": 60,
            "days_back": 7
        }
    }

    # 2. DEFINIR EL CONTEXTO
    # En local, generalmente puedes pasar None si tu código no usa métodos 
    # específicos de context (como get_remaining_time_in_millis)
    context_test = None 

    print("--- INICIANDO PRUEBA LOCAL ---")

    # 3. LLAMAR AL LAMBDA
    # Aquí es donde ocurre la magia: pasas tu diccionario como si fuera el evento de AWS
    respuesta = lambda_handler(event_test_1, context_test)

    # 4. VER RESULTADOS
    print(f"Status Code: {respuesta['statusCode']}")
    
    # Como el body viene como string JSON, lo parseamos para verlo bonito en la terminal
    if 'body' in respuesta:
        body_data = json.loads(respuesta['body'])
        print("\n--- RESPUESTA JSON (BODY) ---")
        print(json.dumps(body_data, indent=2)) # indent=2 lo hace legible
    else:
        print(respuesta)