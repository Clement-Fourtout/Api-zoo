const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const { check, validationResult } = require('express-validator');

const app = express();
const pool = new Pool({
  connectionString: 'URL_DE_CONNEXION_A_VOTRE_BASE_DE_DONNEES_POSTGRESQL',
});

// Middleware pour parser le JSON
app.use(express.json());

// Middleware de validation pour les données de création d'utilisateur
const validateUser = [
  check('email').isEmail(),
  check('password').isLength({ min: 6 }),
];

// Route pour créer un nouvel utilisateur
app.post('/register', authenticateAdmin, validateUser, async (req, res) => {
  // Vérification des erreurs de validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Hachage du mot de passe
  const hashedPassword = await bcrypt.hash(req.body.password, 10);

  // Insertion de l'utilisateur dans la base de données
  try {
    const query = 'INSERT INTO utilisateurs (email, mot_de_passe) VALUES ($1, $2)';
    await pool.query(query, [req.body.email, hashedPassword]);
    res.status(201).json({ message: 'Utilisateur créé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la création de l\'utilisateur :', error);
    res.status(500).json({ message: 'Erreur lors de la création de l\'utilisateur' });
  }
});

function authenticateAdmin(req, res, next) {
  // Vérifier l'authentification de l'utilisateur ici (JWT, sessions, etc.)
  // Vérifier également si l'utilisateur est un administrateur dans la base de données
  // Pour l'exemple, nous supposerons simplement que l'utilisateur est un administrateur
  const isAdmin = true; // Remplacez ceci par votre logique d'authentification et de vérification d'administrateur

  if (isAdmin) {
    next(); // Passer à l'étape suivante (création d'utilisateur)
  } else {
    res.status(403).json({ message: 'Accès interdit' });
  }
}

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
