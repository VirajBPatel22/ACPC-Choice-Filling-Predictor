import pandas as pd

def load_and_clean_data():
    try:
        data_24 = pd.read_csv('data_2024.csv')
        data_25 = pd.read_csv('data_2025.csv')
        
        data_24.columns = data_24.columns.astype(str).str.replace(r'\s+', ' ', regex=True).str.strip()
        data_25.columns = data_25.columns.astype(str).str.replace(r'\s+', ' ', regex=True).str.strip()
        
        data_24 = data_24.rename(columns={
            'Alloted_Cat': 'Category', 
            'Alloted_ Cat': 'Category',   
            'Last Rank': 'Closing_Rank',
            'Quota': 'Board',
            'Institute Type': 'Inst_Type'
        })
        data_25 = data_25.rename(columns={
            'Cat_Name': 'Category', 
            'closing': 'Closing_Rank',
            'Board': 'Board',
            'Type of Institute': 'Inst_Type'
        })
        
        cols_to_clean = ['Inst_Name', 'Course_name', 'Category', 'Board', 'Inst_Type']
        for col in cols_to_clean:
            if col in data_24.columns:
                data_24[col] = data_24[col].astype(str).str.replace(r'\s+', ' ', regex=True).str.strip()
            if col in data_25.columns:
                data_25[col] = data_25[col].astype(str).str.replace(r'\s+', ' ', regex=True).str.strip()
        
        if 'Category' in data_24.columns:
            data_24['Category'] = data_24['Category'].str.upper()
        if 'Category' in data_25.columns:
            data_25['Category'] = data_25['Category'].str.upper()

        data_24 = data_24[data_24['Closing_Rank'] != 'Last Rank']
        data_25 = data_25[data_25['Closing_Rank'] != 'closing']
        
        data_24['Closing_Rank'] = data_24['Closing_Rank'].astype(float)
        data_25['Closing_Rank'] = data_25['Closing_Rank'].astype(float)

        return data_24, data_25
    except Exception as e:
        print(f"Error loading data: {e}")
        return None, None

def predict_colleges(data, student_rank, categories=None, boards=None, inst_types=None, branches=None, inst_names=None, city=""):
    if categories is None:
        categories = ['GEN']

    allowed_cats = set()
    if "ALL" in categories:
        categories = ['GEN']
    for cat in categories:
        if cat in ['SC', 'ST', 'SEBC', 'EWS']:
            allowed_cats.update([cat, 'GEN']) 
        elif cat == 'TFWS':
            allowed_cats.add('TFWS')           
        elif cat == 'GEN':
            allowed_cats.add('GEN')            

    if branches and "ALL" not in branches and any('TFWS' in str(b).upper() for b in branches):
        allowed_cats.add('TFWS')

    if not allowed_cats:
        allowed_cats.add('GEN')

    filtered = data[data['Category'].isin(list(allowed_cats))]
    
    if boards and "ALL" not in boards:
        filtered = filtered[filtered['Board'].isin(boards)]

    if inst_types and "ALL" not in inst_types:
        filtered = filtered[filtered['Inst_Type'].isin(inst_types)]

    if branches and "ALL" not in branches:
        filtered = filtered[filtered['Course_name'].isin(branches)]

    if inst_names and "ALL" not in inst_names:
        filtered = filtered[filtered['Inst_Name'].isin(inst_names)]

    if city.strip():
        filtered = filtered[filtered['Inst_Name'].str.contains(city, case=False, na=False)]
        
    eligible = filtered[filtered['Closing_Rank'] >= student_rank]
    eligible = eligible.sort_values(by='Closing_Rank')
    return eligible[['Inst_Name', 'Course_name', 'Inst_Type', 'Board', 'Category', 'Closing_Rank']]

def load_marks_mapping(filepath):
    mapping = {}
    try:
        import pandas as pd
        df = pd.read_csv(filepath, header=None)
        for row in df.values:
            for i in range(0, len(row)-1, 2):
                try:
                    mark = float(row[i])
                    pr = float(row[i+1])
                    if pd.notna(mark) and pd.notna(pr):
                        mapping[mark] = pr
                except:
                    pass
    except Exception as e:
        print(f"Warning: {filepath} not found or error.")
    return mapping

pcm_24_mapping = load_marks_mapping('pcm_24.csv')
pcm_25_mapping = load_marks_mapping('pcm_25.csv')
gujcet_24_mapping = load_marks_mapping('gujcet_24.csv')
gujcet_25_mapping = load_marks_mapping('gujcet_25.csv')

def get_closest_pr(mapping_dict, target_mark):
    if not mapping_dict:
        return 0
    closest_mark = min(mapping_dict.keys(), key=lambda k: abs(k - target_mark))
    return mapping_dict[closest_mark]
