const express = require('express');
const app = express();
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 3000;

// Middleware pour parser le JSON
app.use(express.json());

// Middleware CORS
app.use(cors());

// Données de démonstration - liste de tâches
let tasks = [
  { id: 1, title: 'Etat de santé :' },
  { id: 2, title: 'Nourriture :' },
  { id: 3, title: 'Grammage :' },
  { id: 4, title: 'Date de passage :' },
];

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

// Autres routes de votre application...
// ...

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
