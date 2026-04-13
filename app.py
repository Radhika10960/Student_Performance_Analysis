from flask import Flask, render_template, request, jsonify
import pandas as pd
from sklearn.linear_model import LinearRegression
import os

app = Flask(__name__)

# Load data and train model
DATA_PATH = os.path.join(os.path.dirname(__file__), 'StudentPerformanceFactors.csv')

# Initialize model and global data
model = LinearRegression()
global_df = None

try:
    if os.path.exists(DATA_PATH):
        df = pd.read_csv(DATA_PATH)
        # Handle simple dropna for safety
        df = df.dropna(subset=['Hours_Studied', 'Attendance', 'Previous_Scores', 'Exam_Score'])
        global_df = df
        
        X = df[['Hours_Studied', 'Attendance', 'Previous_Scores']]
        y = df['Exam_Score']
        
        model.fit(X, y)
        print("Model trained successfully.")
    else:
        print(f"Warning: Data file not found at {DATA_PATH}")
except Exception as e:
    print(f"Error training model: {e}")

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        hours = float(data.get('hours', 0))
        attendance = float(data.get('attendance', 0))
        prev_score = float(data.get('prev_score', 0))
        
        # Make prediction
        prediction = model.predict([[hours, attendance, prev_score]])[0]
        
        # Round the prediction
        predicted_score = round(prediction, 1)
        
        # Cap logic
        predicted_score = min(max(predicted_score, 0), 100)
        
        # Determine Performance Level & Recommendations
        recommendations = []
        
        # Threshold logic based on constraints
        if predicted_score >= 80:
            level = "Good"
            color_theme = "green"
        elif 60 <= predicted_score < 80:
            level = "Average"
            color_theme = "yellow"
        else:
            level = "Needs Improvement"
            color_theme = "red"
            
        # Recommendation Logic
        if hours < 15:
            recommendations.append("Increase your study hours to at least 15-20 hours a week.")
        if attendance < 80:
            recommendations.append("Improve your attendance. Consistency in class helps grasp concepts better.")
        if prev_score < 70:
            recommendations.append("Focus on revising previous topics to build a stronger foundation.")
            
        if not recommendations:
            recommendations.append("Keep up the good work! Maintain your consistent study habits.")
            
        return jsonify({
            'success': True,
            'predicted_score': predicted_score,
            'level': level,
            'color': color_theme,
            'recommendations': recommendations
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/dashboard_data', methods=['GET'])
def dashboard_data():
    if global_df is None:
        return jsonify({'error': 'Data not loaded.'}), 500
        
    # Stats
    total_students = len(global_df)
    avg_score = global_df['Exam_Score'].mean()
    avg_score = round(avg_score, 1) if pd.notnull(avg_score) else 0

    # Sampling points for readability in scatter charts (e.g., 200 max)
    sample_size = min(200, total_students)
    df_sample = global_df.sample(sample_size, random_state=42)

    # Convert to orient format suitable for Chart.js [{x, y}]
    hours_vs_score = df_sample[['Hours_Studied', 'Exam_Score']].rename(columns={'Hours_Studied': 'x', 'Exam_Score': 'y'}).to_dict(orient='records')
    attendance_vs_score = df_sample[['Attendance', 'Exam_Score']].rename(columns={'Attendance': 'x', 'Exam_Score': 'y'}).to_dict(orient='records')

    # Feature Importance (coefficients)
    coef = model.coef_ if hasattr(model, 'coef_') else [0, 0, 0]
    # Normalize for relative importance
    total_coef = sum(abs(c) for c in coef)
    if total_coef > 0:
        importance = [round((abs(c)/total_coef)*100, 1) for c in coef]
    else:
        importance = [33.3, 33.3, 33.3] # fallback

    feature_names = ['Hours', 'Attendance', 'Prev Score']

    return jsonify({
        'metrics': {
            'total_students': total_students,
            'avg_score': avg_score,
        },
        'charts': {
            'hoursVsScore': hours_vs_score,
            'attendanceVsScore': attendance_vs_score,
            'featureImportance': {'labels': feature_names, 'data': importance}
        }
    })

if __name__ == '__main__':
    app.run(debug=True)
