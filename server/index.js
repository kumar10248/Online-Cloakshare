const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
dotenv.config();
const bodyParser = require('body-parser');

const convertRoutes = require('./routes/convertRoutes');
const saveRoutes = require('./routes/saveRoutes');
const showRoutes = require('./routes/showRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const chatRoutes = require('./routes/chat');

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5174", "https://cloakshare.devashish.top"],
  methods: ["GET", "POST"],
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = process.env.PORT || 8000;

app.get('/api',(req,res)=>{
    console.log('Ping')
    res.send('Hello World');
})

require('./connection');

// Initialize Chat Socket Service
const ChatSocketService = require('./services/chatSocketService');
const chatService = new ChatSocketService(server);

const ClipRoute = require('./routes/ClipRoute');
app.use('/api/save', saveRoutes);
app.use('/api/show', showRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/convert', convertRoutes);
app.use('/api/chat', chatRoutes);

app.use('/', ClipRoute);

server.listen(PORT, ()=>{
    console.log(`Server is running on port ${PORT}`);
    console.log('Chat service initialized');
});