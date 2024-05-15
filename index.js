require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());


const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Middleware pour parser le JSON
app.use(express.json());

const corsOptions = {
    origin: 'https://zoo-arcadia-31989dc8c54b.herokuapp.com',
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

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
app.delete('/users/:userId', (req, res) => {
    const userId = req.params.userId;

    // Requête pour supprimer l'utilisateur de la base de données
    const query = 'DELETE FROM utilisateurs WHERE id = ?';
    pool.query(query, [userId], (err, result) => {
        if (err) {
            console.error('Erreur lors de la suppression du compte utilisateur :', err);
            res.status(500).json({ message: 'Erreur lors de la suppression du compte utilisateur' });
        } else {
            if (result.affectedRows > 0) {
                console.log('Utilisateur supprimé avec succès de la base de données :', { userId });
                res.status(200).json({ message: 'Utilisateur supprimé avec succès' });
            } else {
                console.log('Utilisateur non trouvé dans la base de données :', { userId });
                res.status(404).json({ message: 'Utilisateur non trouvé' });
            }
        }
    });
});

app.post('/login', async (req, res) => {
    const { nom, mot_de_passe } = req.body;

    try {
        console.log('Requête de connexion reçue avec les données suivantes :', { nom });

        const query = 'SELECT id, mot_de_passe, role FROM utilisateurs WHERE nom = ?';
        pool.query(query, [nom], async (err, result) => {
            if (err) {
                console.error('Erreur lors de la recherche de l\'utilisateur dans la base de données :', err);
                res.status(500).json({ message: 'Erreur lors de l\'authentification' });
                return;
            }
            if (result.length > 0) {
                const user = result[0];
                console.log('Mot de passe haché récupéré depuis la base de données :', user.mot_de_passe);

                // Utilisez bcrypt.compare() pour comparer les mots de passe hachés
                bcrypt.compare(mot_de_passe, user.mot_de_passe, async (err, match) => {
                    if (err) {
                        console.error('Erreur lors de la comparaison des mots de passe :', err);
                        res.status(500).json({ message: 'Erreur lors de l\'authentification' });
                    } else {
                        if (match) {
                            // Le mot de passe saisi par l'utilisateur correspond au mot de passe haché dans la base de données
                            const token = jwt.sign({ nom }, 'votre_clé_secrète', { expiresIn: '1h' });
                            // Envoyez également le rôle de l'utilisateur dans la réponse JSON
                            res.json({ token, role: user.role, userId: user.id });
                        } else {
                            console.log('Mot de passe incorrect pour l\'utilisateur :', { nom });
                            res.status(401).json({ message: 'Mot de passe incorrect' });
                        }
                    }
                });
            } else {
                console.log('Utilisateur non trouvé dans la base de données :', { nom });
                res.status(404).json({ message: 'Utilisateur non trouvé' });
            }
        });
    } catch (error) {
        console.error('Erreur lors de la recherche de l\'utilisateur dans la base de données :', error);
        res.status(500).json({ message: 'Erreur Base de donnée' });
    }
});

function generateSecurePassword() {
    return Math.random().toString(36).slice(-8);
}

app.post('/register', async (req, res) => {
    const { nom, role, email, username } = req.body;

    try {
        // Générer un mot de passe sécurisé de manière asynchrone
        const mot_de_passe = await generateSecurePassword();
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(mot_de_passe, saltRounds);

        // Insérer le nouvel utilisateur dans la table "utilisateurs"
        const query = 'INSERT INTO utilisateurs (nom, mot_de_passe, role, email, username) VALUES (?, ?, ?, ?, ?)';
        pool.query(query, [nom, hashedPassword, role, email, username], async (err, result) => {
            if (err) {
                console.error('Erreur lors de l\'enregistrement de l\'utilisateur dans la base de données :', err);
                return res.status(500).json({ message: 'Erreur lors de la création de l\'utilisateur' });
            } else {
                console.log('Utilisateur enregistré avec succès dans la base de données :', { nom, role });

                // Envoyer un e-mail de confirmation
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.GMAIL_EMAIL,
                        pass: process.env.GMAIL_PASSWORD
                    }
                });

                const mailOptions = {
                    from: process.env.GMAIL_EMAIL,
                    to: email,
                    subject: 'Confirmation de création de compte',
                    text: `Bonjour ${nom}, votre compte a été créé avec succès. Bienvenue dans notre entreprise ! Votre nom d'utilisateur est : ${username}. Veuillez contacter l'administrateur pour obtenir votre mot de passe.`
                };

                try {
                    await transporter.sendMail(mailOptions);
                    console.log('E-mail de confirmation envoyé');
                } catch (error) {
                    console.error('Erreur lors de l\'envoi de l\'e-mail de confirmation :', error);
                }

                return res.status(201).json({ message: 'Utilisateur créé avec succès', user: { nom, role } });
            }
        });
    } catch (error) {
        console.error('Erreur lors de la création de l\'utilisateur :', error);
        return res.status(500).json({ message: 'Erreur lors de la création de l\'utilisateur' });
    }
});
  



app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});