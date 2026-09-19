import express from "express";

const app = express();

app.listen(8080, () => {
    console.log(`Servidor ativo rodando na porta ${port}`);
});
process.exit(1);
