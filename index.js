const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});
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

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  res.setHeader('Access-Control-Allow-Origin', 'https://zoo-arcadia-31989dc8c54b.herokuapp.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  try {
    // Recherchez l'utilisateur dans la base de données par nom d'utilisateur
    const query = 'SELECT * FROM utilisateurs WHERE nom = $1';
    const result = await pool.query(query, [username]);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      // Si l'utilisateur est trouvé, vérifiez le mot de passe
      const match = await bcrypt.compare(password, user.mot_de_passe);
      
      if (match) {
        // Si le mot de passe correspond, générez un jeton JWT et renvoyez-le
        const token = jwt.sign({ username }, 'votre_clé_secrète', { expiresIn: '1h' });
        res.json({ token });
      } else {
        // Si le mot de passe ne correspond pas, renvoyez une erreur d'authentification
        res.status(401).json({ message: 'Nom d\'utilisateur ou mot de passe incorrect' });
      }
    } else {
      // Si l'utilisateur n'est pas trouvé, renvoyez une erreur d'authentification
      res.status(401).json({ message: 'Nom d\'utilisateur ou mot de passe incorrect' });
    }
  } catch (error) {
    // Gérer les erreurs de base de données
    console.error('Erreur de base de données :', error);
    res.status(500).json({ message: 'Erreur de base de données' });
  }
});


// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
