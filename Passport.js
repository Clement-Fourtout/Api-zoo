const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const { Pool } = require('pg');

const app = express();

// Configuration de la connexion à votre base de données PostgreSQL sur Heroku
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Si vous utilisez une connexion SSL à votre base de données
    }
});

// Middleware d'analyse de corps pour gérer les données JSON
app.use(express.json());

// Middleware d'initialisation de Passport.js
app.use(passport.initialize());

// Configuration de la stratégie de nom d'utilisateur et de mot de passe
passport.use(new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password'
}, async (username, password, done) => {
    try {
        // Requête pour trouver l'utilisateur dans la base de données par nom d'utilisateur
        const query = 'SELECT * FROM utilisateurs WHERE nom_utilisateur = $1';
        const { rows } = await pool.query(query, [username]);

        // Si aucun utilisateur correspondant n'est trouvé ou si le mot de passe est incorrect
        if (rows.length === 0 || rows[0].mot_de_passe !== password) {
            return done(null, false, { message: 'Nom d\'utilisateur ou mot de passe incorrect' });
        }

        // Si l'utilisateur est trouvé et que le mot de passe est correct
        return done(null, rows[0]);
    } catch (error) {
        return done(error);
    }
}));

// Exemple de route protégée nécessitant une authentification
app.get('/profile', passport.authenticate('local'), (req, res) => {
    res.send('Profil utilisateur');
});

// Démarrage du serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});