const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const authRoutes = require('./routes/authRoutes')
const passport = require('passport');
const initializePassport = require('./passport-config');
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

initializePassport(passport);

app.use(passport.initialize());
// Middleware pour parser le JSON
app.use(express.json());

app.use('/auth', authRoutes);

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
  const { nom, mot_de_passe  } = req.body;

  try {
    console.log('Requête de connexion reçue avec les données suivantes :', { nom });

    const query = 'SELECT * FROM utilisateurs WHERE nom = $1';
    const result = await pool.query(query, [nom]);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      const match = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
      
      if (match) {
        const token = jwt.sign({ nom }, 'votre_clé_secrète', { expiresIn: '1h' });
        res.json({ token });
      } else {
        console.log('Mot de passe incorrect pour l\'utilisateur :', { nom });
        res.status(401).json({ message: 'Nom d\'utilisateur ou mot de passe incorrect' });
      }
    } else {
      console.log('Utilisateur non trouvé dans la base de données :', { nom });
      res.status(402).json({ message: 'Nom d\'utilisateur ou mot de passe incorrect' });
    }
  } catch (error) {
    console.error('Erreur lors de la recherche de l\'utilisateur dans la base de données :', error);
    res.status(500).json({ message: 'Erreur lors de l\'authentification' });
  }
});


// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
