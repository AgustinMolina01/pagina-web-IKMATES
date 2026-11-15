// Solicitudes del botón de arrepentimiento, en el panel (pestaña Pedidos).
const { Router } = require("express");
const { listWithdrawals, setWithdrawalStatus, removeWithdrawal } = require("../../servicios/arrepentimiento.servicio");

const router = Router();

router.get("/", (req, res) => res.json(listWithdrawals()));

router.put("/:id", (req, res) => {
  if (!setWithdrawalStatus(Number(req.params.id), String(req.body.status || ""))) return res.status(400).json({ error: "Estado inválido" });
  res.json({ ok: true });
});

router.delete("/:id", (req, res) => {
  removeWithdrawal(Number(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
