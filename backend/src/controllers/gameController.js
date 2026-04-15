import { supabase } from '../utils/supabase.js';

export const getCategories = async (req, res) => {
  try {
    // Obtenemos categorias con sus respectivas preguntas
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*, questions(*)');

    if (error) throw error;
    res.json({ success: true, categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { name, isCustom } = req.body;
    const { data, error } = await supabase
      .from('categories')
      .insert([{ name, isCustom }])
      .select();

    if (error) throw error;
    res.json({ success: true, category: data[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const addQuestionToCategory = async (req, res) => {
  try {
    const { category_id, question, answer, points } = req.body;
    
    // Validar puntos: 200, 400, 600, 800, 1000
    if (![200, 400, 600, 800, 1000].includes(points)) {
      return res.status(400).json({ success: false, message: 'Los puntos pueden ser solo: 200, 400, 600, 800, 1000' });
    }

    const { data, error } = await supabase
      .from('questions')
      .insert([{ category_id, question, answer, points }])
      .select();

    if (error) throw error;
    res.json({ success: true, question: data[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};