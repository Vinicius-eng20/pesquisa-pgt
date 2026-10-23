// Carrega as ferramentas que instalamos
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURAÇÃO ---
// ATENÇÃO: Mude esta senha para uma senha forte e secreta!
const JWT_SECRET = 'sua-senha-super-secreta-e-dificil-de-adivinhar';

// Conexão com o banco de dados MongoDB
// Certifique-se de que o MongoDB está rodando no seu servidor
const MONGO_URI = 'mongodb://localhost:27017/restauranteDB';
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Conectado ao MongoDB com sucesso!'))
    .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

// --- "MOLDE" DOS DADOS (SCHEMAS) ---

// Molde para os Usuários (clientes e gerente)
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false }
});
const User = mongoose.model('User', UserSchema);

// Molde para os Pratos do Cardápio
const DishSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true }
});
const Dish = mongoose.model('Dish', DishSchema);

// Molde para os Pedidos
const OrderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [{ dish: { type: mongoose.Schema.Types.ObjectId, ref: 'Dish' }, quantity: Number }],
    status: { type: String, enum: ['Pendente', 'Em Preparo', 'Pronto para Entrega', 'Entregue', 'Cancelado'], default: 'Pendente' },
    createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', OrderSchema);


// --- PREPARAÇÃO DO SERVIDOR ---
app.use(cors()); // Permite que o site seja acessado de qualquer lugar
app.use(express.json()); // Permite que o servidor entenda JSON

// --- FUNÇÕES DE VERIFICAÇÃO (MIDDLEWARE) ---
const authMiddleware = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ msg: 'Sem token, autorização negada' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (e) {
        res.status(400).json({ msg: 'Token não é válido' });
    }
};

const adminMiddleware = (req, res, next) => {
    if (!req.user.isAdmin) return res.status(403).json({ msg: 'Acesso negado. Rota apenas para administradores.' });
    next();
};

// --- ROTAS (AS "PÁGINAS" DA NOSSA API) ---

// ROTA DE REGISTRO DE USUÁRIO
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: 'Usuário já existe' });
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({ email, password: hashedPassword });
        await user.save();
        res.status(201).json({ msg: 'Usuário registrado com sucesso!' });
    } catch (err) { res.status(500).send('Erro no servidor'); }
});

// ROTA DE LOGIN
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: 'Credenciais inválidas' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Credenciais inválidas' });

        const payload = { user: { id: user.id, isAdmin: user.isAdmin } };
        jwt.sign(payload, JWT_SECRET, { expiresIn: '5h' }, (err, token) => {
            if (err) throw err;
            res.json({ token });
        });
    } catch (err) { res.status(500).send('Erro no servidor'); }
});

// ROTAS DO CARDÁPIO
app.get('/api/dishes', async (req, res) => {
    const dishes = await Dish.find();
    res.json(dishes);
});
app.post('/api/dishes', [authMiddleware, adminMiddleware], async (req, res) => {
    const newDish = new Dish(req.body);
    const dish = await newDish.save();
    res.json(dish);
});
app.put('/api/dishes/:id', [authMiddleware, adminMiddleware], async (req, res) => {
    const dish = await Dish.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(dish);
});
app.delete('/api/dishes/:id', [authMiddleware, adminMiddleware], async (req, res) => {
    await Dish.findByIdAndRemove(req.params.id);
    res.json({ msg: 'Prato removido' });
});

// ROTAS DE PEDIDOS
app.post('/api/orders', authMiddleware, async (req, res) => {
    const newOrder = new Order({ user: req.user.id, items: req.body.items });
    const order = await newOrder.save();
    res.json(order);
});
app.get('/api/orders/myorders', authMiddleware, async (req, res) => {
    const orders = await Order.find({ user: req.user.id }).populate('items.dish');
    res.json(orders);
});
app.get('/api/orders', [authMiddleware, adminMiddleware], async (req, res) => {
    const orders = await Order.find().populate('user', 'email').populate('items.dish');
    res.json(orders);
});
app.put('/api/orders/:id/status', [authMiddleware, adminMiddleware], async (req, res) => {
    const order = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    res.json(order);
});

// --- INICIANDO O SERVIDOR ---
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));

// --- COMANDO ESPECIAL PARA CRIAR GERENTE ---
if (process.argv[2] === 'make-admin') {
    const email = process.argv[3];
    if (!email) {
        console.log('Por favor, forneça um e-mail. Ex: node server.js make-admin "seu@email.com"');
        return;
    }
    mongoose.connect(MONGO_URI).then(async () => {
        const user = await User.findOneAndUpdate({ email }, { isAdmin: true });
        if (user) {
            console.log(`O usuário ${email} agora é um administrador.`);
        } else {
            console.log(`Usuário com e-mail ${email} não encontrado.`);
        }
        mongoose.disconnect();
    });
}
