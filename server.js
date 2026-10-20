const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true, service: "carrera-torrente-sanguineo" }));

const rooms = new Map();
const questions = [
  { topic: "Vasos sanguíneos", text: "¿Qué vasos llevan la sangre desde el corazón hacia los órganos?", options: ["Las venas", "Las arterias", "Los capilares"], correct: 1, explanation: "Las arterias llevan la sangre desde el corazón hacia los tejidos. Las venas la devuelven al corazón." },
  { topic: "Intercambio", text: "¿En qué vasos se intercambian oxígeno, nutrientes y desechos con los tejidos?", options: ["Arterias", "Venas", "Capilares"], correct: 2, explanation: "Los capilares tienen paredes muy delgadas que permiten el intercambio de sustancias con las células." },
  { topic: "Sangre", text: "¿Qué componente transporta principalmente el oxígeno?", options: ["Glóbulos rojos", "Plaquetas", "Plasma solamente"], correct: 0, explanation: "Los glóbulos rojos contienen hemoglobina, una proteína que transporta gran parte del oxígeno." },
  { topic: "Circulación", text: "¿Qué órgano impulsa la sangre por el cuerpo?", options: ["Los pulmones", "El corazón", "El hígado"], correct: 1, explanation: "El corazón funciona como una bomba muscular que impulsa la sangre por los circuitos circulatorios." },
  { topic: "Venas", text: "¿Qué afirmación sobre las venas es correcta?", options: ["Siempre transportan sangre con mucho oxígeno", "Llevan sangre hacia el corazón", "No contienen sangre"], correct: 1, explanation: "Las venas llevan la sangre hacia el corazón. La cantidad de oxígeno depende del circuito; las venas pulmonares son una excepción a la regla general sobre sangre poco oxigenada." },
  { topic: "Plaquetas", text: "¿Qué función cumplen principalmente las plaquetas?", options: ["Ayudan a la coagulación", "Transportan oxígeno", "Producen impulsos nerviosos"], correct: 0, explanation: "Las plaquetas participan en la formación del tapón inicial que ayuda a detener las hemorragias." },
  { topic: "Circulación pulmonar", text: "¿Dónde se oxigena la sangre durante la circulación pulmonar?", options: ["En los riñones", "En los pulmones", "En los músculos"], correct: 1, explanation: "En los pulmones, la sangre libera dióxido de carbono y capta oxígeno en los alvéolos." },
  { topic: "Plasma", text: "¿Qué es el plasma sanguíneo?", options: ["La parte líquida de la sangre", "Un tipo de arteria", "Una célula muscular"], correct: 0, explanation: "El plasma es la parte líquida de la sangre y transporta agua, proteínas, nutrientes, hormonas y otras sustancias." },
  { topic: "Presión", text: "¿En qué vasos suele ser mayor la presión sanguínea?", options: ["En las arterias cercanas al corazón", "En las venas más pequeñas", "Es siempre igual en todos los vasos"], correct: 0, explanation: "La presión suele ser más alta en las arterias, especialmente cerca del corazón, y disminuye a lo largo de la circulación." },
  { topic: "Recorrido", text: "Después de pasar por los capilares de los tejidos, la sangre regresa al corazón principalmente por…", options: ["Las venas", "Las arterias", "Los bronquios"], correct: 0, explanation: "La sangre que sale de los capilares entra en vénulas y venas, que la conducen de regreso al corazón." }
];

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[crypto.randomInt(chars.length)];
  return code;
}
function publicRoom(room) {
  return {
    code: room.code, status: room.status, questionIndex: room.questionIndex,
    question: room.status === "question" ? {
      index: room.questionIndex, total: questions.length,
      topic: questions[room.questionIndex].topic,
      text: questions[room.questionIndex].text,
      options: questions[room.questionIndex].options,
      deadline: room.deadline
    } : null,
    players: [...room.players.values()].map(p => ({
      id: p.id, name: p.name, color: p.color, score: p.score,
      progress: p.progress, answered: p.answered
    })).sort((a,b) => b.score-a.score || b.progress-a.progress || a.name.localeCompare(b.name)),
    hostConnected: room.hostSocketId ? io.sockets.sockets.has(room.hostSocketId) : false
  };
}
function broadcast(room) { io.to(room.code).emit("room:state", publicRoom(room)); }
function errorTo(socket, message) { socket.emit("app:error", message); }

io.on("connection", socket => {
  socket.on("room:create", ({ teacherName } = {}) => {
    let code = makeCode();
    while (rooms.has(code)) code = makeCode();
    const room = {
      code, hostSocketId: socket.id, teacherName: String(teacherName || "Profesor").slice(0,40),
      status: "lobby", questionIndex: -1, deadline: null, players: new Map(),
      answeredThisQuestion: new Set(), createdAt: Date.now()
    };
    rooms.set(code, room);
    socket.data.roomCode = code; socket.data.role = "host";
    socket.join(code);
    socket.emit("room:created", { code, joinUrl: null });
    broadcast(room);
  });

  socket.on("player:join", ({ code, name, color } = {}) => {
    code = String(code || "").trim().toUpperCase();
    name = String(name || "").trim().slice(0,24);
    const room = rooms.get(code);
    if (!room) return errorTo(socket, "No encontramos esa sala. Revisa el código.");
    if (room.status === "finished") return errorTo(socket, "Esta carrera ya terminó.");
    if (!name) return errorTo(socket, "Escribe tu nombre para entrar.");
    const exists = [...room.players.values()].some(p => p.name.toLowerCase() === name.toLowerCase());
    if (exists) return errorTo(socket, "Ese nombre ya está en la sala. Prueba con otro.");
    const player = { id: socket.id, name, color: ["#ff5252","#42a5f5","#66bb6a","#ffca28","#ab47bc","#26c6da"][Math.abs((color||0)%6)], score: 0, progress: 0, answered: false, joinedAt: Date.now() };
    room.players.set(socket.id, player);
    socket.data.roomCode = code; socket.data.role = "player";
    socket.join(code);
    socket.emit("player:joined", { code, playerId: socket.id });
    broadcast(room);
  });

  socket.on("game:start", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || socket.data.role !== "host" || room.hostSocketId !== socket.id) return errorTo(socket, "Solo el profesor que creó la sala puede iniciar.");
    if (room.players.size < 1) return errorTo(socket, "Espera a que entre al menos un alumno.");
    room.status = "question"; room.questionIndex = 0;
    showQuestion(room);
  });

  socket.on("game:pause", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || socket.data.role !== "host" || room.hostSocketId !== socket.id) return;
    if (room.status === "paused") {
      room.status = room.questionIndex >= 0 ? "question" : "lobby";
      if (room.status === "question") room.deadline = Date.now() + 30000;
    } else if (["question","lobby","results"].includes(room.status)) {
      room.status = "paused";
    }
    broadcast(room);
  });

  socket.on("answer:submit", ({ answer } = {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || socket.data.role !== "player") return errorTo(socket, "No estás dentro de una sala.");
    const player = room.players.get(socket.id);
    if (!player || room.status !== "question") return errorTo(socket, "La pregunta no está abierta.");
    if (player.answered) return errorTo(socket, "Ya respondiste esta pregunta.");
    if (Date.now() > room.deadline) return errorTo(socket, "Se acabó el tiempo para responder.");
    const q = questions[room.questionIndex];
    const correct = Number(answer) === q.correct;
    player.answered = true;
    if (correct) {
      const remaining = Math.max(0, room.deadline - Date.now());
      const bonus = Math.round(50 * remaining / 30000);
      player.score += 100 + bonus;
      player.progress = Math.min(100, player.progress + 10);
    }
    socket.emit("answer:feedback", {
      correct, correctIndex: q.correct, explanation: q.explanation,
      gained: correct ? 100 + Math.round(50 * Math.max(0, room.deadline - Date.now()) / 30000) : 0,
      score: player.score
    });
    broadcast(room);
    if ([...room.players.values()].every(p => p.answered)) room.status = "results";
    broadcast(room);
  });

  socket.on("question:next", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || socket.data.role !== "host" || room.hostSocketId !== socket.id) return errorTo(socket, "Solo el profesor puede avanzar.");
    if (room.questionIndex >= questions.length - 1) {
      room.status = "finished"; room.deadline = null; broadcast(room); return;
    }
    room.questionIndex += 1;
    room.status = "question";
    showQuestion(room);
  });

  socket.on("game:finish", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || socket.data.role !== "host" || room.hostSocketId !== socket.id) return;
    room.status = "finished"; room.deadline = null; broadcast(room);
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;
    if (room.hostSocketId === socket.id) room.hostSocketId = null;
    room.players.delete(socket.id);
    broadcast(room);
    // Rooms are intentionally in-memory for this starter. They are removed after an empty-room grace period.
    if (!room.hostSocketId && room.players.size === 0) setTimeout(() => {
      const current = rooms.get(code);
      if (current && !current.hostSocketId && current.players.size === 0) rooms.delete(code);
    }, 60000);
  });
});

function showQuestion(room) {
  room.status = "question";
  room.deadline = Date.now() + 30000;
  room.answeredThisQuestion = new Set();
  for (const p of room.players.values()) p.answered = false;
  broadcast(room);
  setTimeout(() => {
    const current = rooms.get(room.code);
    if (current === room && room.status === "question" && Date.now() >= room.deadline) {
      room.status = "results"; broadcast(room);
    }
  }, 30050);
}

server.listen(PORT, "0.0.0.0", () => console.log(`Carrera por el torrente sanguíneo disponible en el puerto ${PORT}`));
