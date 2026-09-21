import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import rotasResolver from "./routes/resolver.js";
import rotasUtilidades from "./routes/utilidades.js";
import { listarPuzzlesFixos } from "./servicos/PuzzlesFixos.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORTA = Number(process.env.PORTA ?? 8080);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// O corpo da requisicao carrega apenas uma matriz 9x9, entao o limite pode ser pequeno.
// A resposta e que pode ser grande (o sudoku dificil gera ~18MB de eventos), mas isso
// nao passa por este limite, que vale somente para entrada.
app.use(express.json({ limit: "64kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.use("/api", rotasResolver);
app.use("/api", rotasUtilidades);

app.get("/", (requisicao, resposta) => {
    resposta.render("index", {
        puzzlesFixos: listarPuzzlesFixos(),
    });
});

app.use((erro, requisicao, resposta, proximo) => {
    console.error("Erro nao tratado:", erro);
    resposta.status(500).json({
        erro: "ERRO_INTERNO",
        mensagem: erro.message,
    });
});

app.listen(PORTA, () => {
    console.log(`Servidor ativo em http://localhost:${PORTA}`);
});
