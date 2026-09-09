from flask import Flask, request, jsonify, render_template
import pandas as pd
from data_processor import load_and_clean_data, predict_colleges, pcm_24_mapping, pcm_25_mapping, gujcet_24_mapping, gujcet_25_mapping, get_closest_pr
 

app = Flask(__name__)
data_24, data_25 = load_and_clean_data()

@app.route('/')
def home():
    if data_25 is not None:
        boards = sorted([b for b in data_25['Board'].unique() if str(b).lower() != 'nan'])
        inst_types = sorted([t for t in data_25['Inst_Type'].unique() if str(t).lower() != 'nan'])
        branches = sorted([c for c in data_25['Course_name'].unique() if str(c).lower() != 'nan'])
        institutes = sorted([i for i in data_25['Inst_Name'].unique() if str(i).lower() != 'nan'])
    else:
        boards, inst_types, branches, institutes = [], [], [], []

    return render_template('index.html', boards=boards, inst_types=inst_types, branches=branches, institutes=institutes)

@app.route('/predict', methods=['POST'])
def predict():
    if data_25 is None:
        return jsonify({"error": "Database not loaded properly."})

    data = request.get_json()
    student_rank = float(data.get('rank', 0)) if data.get('rank') else 0
    categories = data.get('category', ['GEN'])  
    
    boards = data.get('board', ['ALL'])
    inst_types = data.get('inst_type', ['ALL'])
    branches = data.get('branch', ['ALL'])
    inst_names = data.get('inst_name', ['ALL'])
    city = data.get('city', '')

    results = predict_colleges(data_25, student_rank, categories, boards, inst_types, branches, inst_names, city)
    
    colleges = results.to_dict(orient='records')
    return jsonify(colleges)
@app.route('/calculate_rank', methods=['POST'])
def calc_rank_api():
    data = request.get_json()
    pcm_mark = float(data.get('pcm', 0))
    gujcet_mark = float(data.get('gujcet', 0))
    pcm_pr_24 = get_closest_pr(pcm_24_mapping, pcm_mark)
    pcm_pr_25 = get_closest_pr(pcm_25_mapping, pcm_mark)
    avg_pcm_pr = (pcm_pr_24 + pcm_pr_25) / 2 if (pcm_pr_24 and pcm_pr_25) else (pcm_pr_24 or pcm_pr_25)
    gujcet_pr_24 = get_closest_pr(gujcet_24_mapping, gujcet_mark)
    gujcet_pr_25 = get_closest_pr(gujcet_25_mapping, gujcet_mark)
    avg_gujcet_pr = (gujcet_pr_24 + gujcet_pr_25) / 2 if (gujcet_pr_24 and gujcet_pr_25) else (gujcet_pr_24 or gujcet_pr_25)
    if avg_pcm_pr > 0 and avg_gujcet_pr > 0:
        merit_pr = (avg_pcm_pr * 0.5) + (avg_gujcet_pr * 0.5)
        est_rank = int(round((100 - merit_pr) * 400))
        if est_rank < 1: 
            est_rank = 1
            
        return jsonify({
            'rank': est_rank, 
            'pcm_pr': round(avg_pcm_pr, 4), 
            'gujcet_pr': round(avg_gujcet_pr, 4)
        })
    return jsonify({'rank': 0})

if __name__ == '__main__':
    app.run(debug=True)