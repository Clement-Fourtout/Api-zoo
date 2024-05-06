const express = require('express');
const app = express();
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const PORT = process.env.PORT || 3000;

// Middleware pour parser le JSON
app.use(express.json());

const corsOptions = {
  origin: 'https://zoo-arcadia-31989dc8c54b.herokuapp.com',
  optionsSuccessStatus: 200 // Certains navigateurs peuvent exiger une option de statut de succès explicite
};

app.use(cors(corsOptions));
// Données de démonstration - liste de tâches
let tasks = [
  { id: 1, title: 'Etat de santé :' },
  { id: 2, title: 'Nourriture :' },
  { id: 3, title: 'Grammage :' },
  { id: 4, title: 'Date de passage :' },
];

// Récupérer toutes les tâches
app.get('/tasks', (req, res) => {
  res.json(tasks);
});

// Récupérer une tâche par son ID
app.get('/tasks/:id', (req, res) => {
  const taskId = parseInt(req.params.id);
  const task = tasks.find(task => task.id === taskId);
  if (task) {
    res.json(task);
  } else {
    res.status(404).json({ message: 'Tâche non trouvée' });
  }
});

// Ajouter une nouvelle tâche
app.post('/tasks', (req, res) => {
  const { title } = req.body;
  const newTask = { id: tasks.length + 1, title };
  tasks.push(newTask);
  res.status(201).json(newTask);
});

// Mettre à jour une tâche existante
app.put('/tasks/:id', (req, res) => {
  const taskId = parseInt(req.params.id);
  const task = tasks.find(task => task.id === taskId);
  if (task) {
    task.title = req.body.title;
    res.json(task);
  } else {
    res.status(404).json({ message: 'Tâche non trouvée' });
  }
});

// Supprimer une tâche
app.delete('/tasks/:id', (req, res) => {
  const taskId = parseInt(req.params.id);
  tasks = tasks.filter(task => task.id !== taskId);
  res.status(204).end();
});

// Route de connexion
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  // Votre logique d'authentification ici
  // Par exemple, vérifier si les identifiants sont valides dans une base de données
  if (username === 'admin' && password === 'password') {
    // Si l'authentification réussit, générez un jeton JWT
    const token = jwt.sign({ username }, 'votre_clé_secrète', { expiresIn: '1h' });
    res.json({ token });
  } else {
    res.status(401).json({ message: 'Nom d\'utilisateur ou mot de passe incorrect' });
  }
});

// Middleware pour vérifier le jeton JWT
function verifyToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ message: 'Jetons d\'accès manquant' });

  jwt.verify(token, 'votre_clé_secrète', (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Jetons d\'accès invalide' });
    req.user = decoded;
    next();
  });
}

// Exemple de route protégée
app.get('/protected', verifyToken, (req, res) => {
  res.json({ message: 'Route protégée', user: req.user });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
