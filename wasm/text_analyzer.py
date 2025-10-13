"""
Text analysis utilities for WasmOS
Compile with Emscripten or use with Pyodide
"""

def count_words(text):
    """Count words in text"""
    return len(text.split())

def count_sentences(text):
    """Count sentences in text"""
    import re
    sentences = re.split(r'[.!?]+', text)
    return len([s for s in sentences if s.strip()])

def count_paragraphs(text):
    """Count paragraphs in text"""
    paragraphs = text.split('\n\n')
    return len([p for p in paragraphs if p.strip()])

def reading_time(text, wpm=200):
    """Calculate reading time in minutes"""
    words = count_words(text)
    return round(words / wpm, 1)

def text_statistics(text):
    """Get comprehensive text statistics"""
    words = text.split()
    chars = len(text)
    chars_no_spaces = len(text.replace(' ', ''))
    
    return {
        'characters': chars,
        'characters_no_spaces': chars_no_spaces,
        'words': len(words),
        'sentences': count_sentences(text),
        'paragraphs': count_paragraphs(text),
        'avg_word_length': round(sum(len(w) for w in words) / len(words), 1) if words else 0,
        'reading_time': reading_time(text)
    }

def find_most_common_words(text, n=10):
    """Find n most common words"""
    from collections import Counter
    import re
    
    # Remove punctuation and convert to lowercase
    words = re.findall(r'\b\w+\b', text.lower())
    
    # Filter out common stop words
    stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
                  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 
                  'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 
                  'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'}
    
    filtered_words = [w for w in words if w not in stop_words and len(w) > 2]
    
    counter = Counter(filtered_words)
    return counter.most_common(n)

def sentiment_analysis(text):
    """Simple sentiment analysis"""
    # Positive and negative word lists (simplified)
    positive_words = {'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 
                     'love', 'happy', 'joy', 'beautiful', 'perfect', 'best', 'awesome'}
    negative_words = {'bad', 'terrible', 'awful', 'horrible', 'hate', 'sad', 'angry', 
                     'worst', 'poor', 'disappointing', 'negative', 'ugly', 'disgusting'}
    
    words = text.lower().split()
    pos_count = sum(1 for w in words if w in positive_words)
    neg_count = sum(1 for w in words if w in negative_words)
    
    total = pos_count + neg_count
    if total == 0:
        return {'sentiment': 'neutral', 'score': 0, 'positive': 0, 'negative': 0}
    
    score = (pos_count - neg_count) / total
    
    if score > 0.2:
        sentiment = 'positive'
    elif score < -0.2:
        sentiment = 'negative'
    else:
        sentiment = 'neutral'
    
    return {
        'sentiment': sentiment,
        'score': round(score, 2),
        'positive': pos_count,
        'negative': neg_count
    }

def extract_keywords(text, n=5):
    """Extract keywords using simple TF-IDF approximation"""
    import re
    from collections import Counter
    
    words = re.findall(r'\b\w+\b', text.lower())
    
    # Simple keyword extraction based on frequency and length
    word_scores = {}
    for word in set(words):
        if len(word) > 3:
            freq = words.count(word)
            length_bonus = len(word) / 10
            word_scores[word] = freq * (1 + length_bonus)
    
    sorted_words = sorted(word_scores.items(), key=lambda x: x[1], reverse=True)
    return [word for word, score in sorted_words[:n]]

def readability_score(text):
    """Calculate Flesch Reading Ease score"""
    words = count_words(text)
    sentences = count_sentences(text)
    
    if words == 0 or sentences == 0:
        return 0
    
    # Count syllables (simplified)
    syllables = sum(count_syllables(w) for w in text.split())
    
    # Flesch Reading Ease formula
    score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)
    
    return round(max(0, min(100, score)), 1)

def count_syllables(word):
    """Count syllables in a word (simplified)"""
    import re
    word = word.lower()
    vowels = 'aeiouy'
    syllable_count = 0
    previous_was_vowel = False
    
    for char in word:
        is_vowel = char in vowels
        if is_vowel and not previous_was_vowel:
            syllable_count += 1
        previous_was_vowel = is_vowel
    
    # Adjust for silent e
    if word.endswith('e'):
        syllable_count -= 1
    
    # Ensure at least one syllable
    return max(1, syllable_count)
