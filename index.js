const express = require('express');
const app = express();
const cors = require('cors');
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
  { id: 1, title: 'Etat de santé' },
  { id: 2, title: 'Nourriture' },
  { id: 2, title: 'Grammage' },
  { id: 2, title: 'Date de passage' },
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

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
