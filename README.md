# Carrera por el torrente sanguíneo 2.0

Juego educativo web multijugador para profesor y alumnos.

## Ejecutar localmente
Requiere Node.js 18 o posterior.

```bash
npm install
npm start
```

Abre http://localhost:3000

## Publicar en Render desde GitHub
1. Sube TODO el contenido de esta carpeta al repositorio, conservando `public/index.html`.
2. En Render crea un **Web Service** conectado al repositorio.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Publica y abre la URL HTTPS que Render te asigne.

## Funciones incluidas
- Crear sala con código de acceso.
- Entrada de alumnos por código y nombre.
- Panel docente: iniciar, pausar/reanudar, avanzar y finalizar.
- Preguntas de biología con explicación después de responder.
- Pista y clasificación compartidas mediante Socket.IO.
- Puntuación calculada en el servidor.
- Endpoint de comprobación `/health`.

## Limitaciones importantes de esta versión inicial
- Las salas viven en la memoria del servidor y se pierden al reiniciarse.
- No hay base de datos ni historial persistente.
- No hay recuperación de sesión tras una desconexión.
- Para producción escolar, añade autenticación del profesor, moderación de nombres, persistencia, límites de frecuencia y pruebas con varios dispositivos.
- El enlace compartido y el código de sala permiten entrar; no compartas información personal sensible.

El juego solo está sincronizado entre dispositivos cuando se ejecuta en un servidor accesible por todos. Abrir el HTML como archivo local no crea una sala multijugador.
