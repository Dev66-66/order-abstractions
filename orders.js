// Обработка заказов с выделенными абстракциями:
// предметная область (Orders), сохранение (orderRepo), уведомление (notifier).

// 1. Предметная область — чистая логика, ничего не знает про HTTP, БД и почту
class EmptyOrderError extends Error {}

const Orders = {
  calcTotal(items) {
    if (!items.length) throw new EmptyOrderError("empty");
    let total = items.reduce((s, i) => s + i.price * i.qty, 0);
    if (total > 10000) total *= 0.95;
    return total;
  },
};

// 2. Сохранение — весь SQL здесь
const orderRepo = {
  create: (userId, total) =>
    db.query("INSERT INTO orders (user_id, total) VALUES ($1, $2)", [userId, total]),
  update: (orderId, total) =>
    db.query("UPDATE orders SET total = $1 WHERE id = $2", [total, orderId]),
};

// 3. Уведомление — вся почта здесь
const notifier = {
  orderCreated: (email) => smtp.send(email, "Заказ принят"),
  orderUpdated: (email) => smtp.send(email, "Заказ изменён"),
};

// HTTP — только разбор запроса и ответ; ошибки предметной области переводятся в 400
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e instanceof EmptyOrderError) return res.status(400).send(e.message);
    throw e;
  }
};

const createOrder = handle(async (req, res) => {
  const body = JSON.parse(req.body);
  const total = Orders.calcTotal(body.items);
  await orderRepo.create(req.user.id, total);
  await notifier.orderCreated(req.user.email);
  res.status(201).send(JSON.stringify({ total }));
});

const editOrder = handle(async (req, res) => {
  const body = JSON.parse(req.body);
  const total = Orders.calcTotal(body.items);
  await orderRepo.update(req.params.id, total);
  await notifier.orderUpdated(req.user.email);
  res.status(200).send(JSON.stringify({ total }));
});
