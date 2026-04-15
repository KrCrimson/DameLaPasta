import { Router } from 'express';
import { getCategories, createCategory, addQuestionToCategory } from '../controllers/gameController.js';

const router = Router();

// Endpoint para traer las categorías (Las cuales usaremos en el frontend para armar el panel de 200 a 1000)
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.post('/questions', addQuestionToCategory);

export default router;