const express = require('express');
const app = express();
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;

// Middleware pour parser le JSON
app.use(express.json());

app.use(cors({
  origin: 'https://zoo-arcadia-31989dc8c54b.herokuapp.com',
  optionsSuccessStatus: 200 // Certains navigateurs peuvent exiger une option de statut de succès explicite
}));

// Configuration de la connexion à la base de données PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Utilisez la variable d'environnement DATABASE_URL pour la connexion à Heroku PostgreSQL
  ssl: {
    rejectUnauthorized: false // Autoriser les connexions SSL non autorisées pour Heroku
  }
});

// Route de connexion
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

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
