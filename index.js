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


// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
