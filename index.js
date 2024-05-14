const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());


const pool = mysql.createPool({
    host: 's554ongw9quh1xjs.cbetxkdyhwsb.us-east-1.rds.amazonaws.com',
    user: 'khymtarlf49pzb85',
    password: 'bjg5chusdgv0d43k',
    database: 'mmdp8u9ooq9t3162',
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
app.delete('/tasks/:id', (req, res) => {
    const taskId = parseInt(req.params.id);
    tasks = tasks.filter(task => task.id !== taskId);
    res.status(204).end();
});

app.post('/login', async (req, res) => {
    const { nom, mot_de_passe } = req.body;
  
    try {
        console.log('Requête de connexion reçue avec les données suivantes :', { nom });
  
        const query = 'SELECT * FROM utilisateurs WHERE nom = ?';
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
                            res.json({ token, role: user.role });
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
  

  app.post('/register', async (req, res) => {
    const { nom, mot_de_passe, role } = req.body;
  
    try {
        // Générer un sel pour le hachage du mot de passe
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(mot_de_passe, saltRounds);
  
        // Insérer le nouvel utilisateur dans la table "utilisateurs"
        const query = 'INSERT INTO utilisateurs (nom, mot_de_passe, role) VALUES (?, ?, ?)';
        pool.query(query, [nom, hashedPassword, role], (err, result) => {
            if (err) {
                console.error('Erreur lors de l\'enregistrement de l\'utilisateur dans la base de données :', err);
                res.status(500).json({ message: 'Erreur lors de la création de l\'utilisateur' });
            } else {
                console.log('Utilisateur enregistré avec succès dans la base de données :', { nom, role });
                res.status(201).json({ message: 'Utilisateur créé avec succès', user: { nom, role } });
            }
        });
    } catch (error) {
        console.error('Erreur lors de la création de l\'utilisateur :', error);
        res.status(500).json({ message: 'Erreur lors de la création de l\'utilisateur' });
    }
});
  
app.delete('/users/:userId', async (req, res) => {
    const userId = req.params.userId;

    try {
        const query = 'DELETE FROM utilisateurs WHERE id = ?';
        pool.query(query, [userId], (err, result) => {
            if (err) {
                console.error('Erreur lors de la suppression de l\'utilisateur :', err);
                res.status(500).json({ message: 'Erreur lors de la suppression de l\'utilisateur' });
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
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'utilisateur :', error);
        res.status(500).json({ message: 'Erreur lors de la suppression de l\'utilisateur' });
    }
});


app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});