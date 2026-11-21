# Charts for the AI model selection case study: light (documents) and dark (presentation) versions.
import sys, pathlib, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

OUT = pathlib.Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
TESTS = ['1 Campus to coffee', '2 Evening dinner', '3 Winter layering', '4 Restricted wardrobe']
SCORES = {'Claude': [94, 95, 94, 95], 'ChatGPT': [94, 95, 93, 93], 'Gemini': [89, 93, 79, 92]}
FINAL = {'Claude': 96, 'ChatGPT': 95, 'Gemini': 93}
AVG = {m: sum(v) / 4 for m, v in SCORES.items()}

THEMES = {
    'light': dict(bg='white', ink='#2a2626', quiet='#8a807c', grid='#ece4dd', accent='#c48a86', other='#9a8f8a', third='#cfc6c1', font='Liberation Serif'),
    'dark': dict(bg='none', ink='#F6EFE9', quiet='#C9BDB4', grid='#5a4b4a', accent='#E8D3A6', other='#A89C96', third='#8C807A', font='Liberation Serif'),
}

def style(ax, t):
    for s in ax.spines.values(): s.set_visible(False)
    ax.tick_params(colors=t['quiet'], length=0, labelsize=11)
    ax.grid(axis='x', color=t['grid'], lw=0.8); ax.set_axisbelow(True)

def colours(t): return {'Claude': t['accent'], 'ChatGPT': t['other'], 'Gemini': t['third']}

def by_test(name, t):
    c = colours(t); plt.rcParams['font.family'] = t['font']
    fig, ax = plt.subplots(figsize=(9, 4.2) if t['bg'] != 'none' else (6.6, 3.9), dpi=200); fig.patch.set_alpha(0 if t['bg'] == 'none' else 1)
    if t['bg'] != 'none': fig.patch.set_facecolor(t['bg'])
    ax.set_facecolor('none'); style(ax, t)
    off = {'Claude': -0.18, 'ChatGPT': 0, 'Gemini': 0.18}
    for m, vals in SCORES.items():
        ys = [i + off[m] for i in range(4)]
        ax.scatter(vals, ys, s=110, color=c[m], label=m, zorder=3, edgecolor='none')
        for v, y in zip(vals, ys):
            if m == 'Claude' or v < 85: ax.text(v + 0.5, y, str(v), va='center', fontsize=11, color=t['ink'] if m == 'Claude' else t['quiet'])
    ax.set_yticks(range(4)); ax.set_yticklabels(TESTS, color=t['ink'], fontsize=12); ax.invert_yaxis()
    ax.set_xlim(75, 100); ax.set_xticks([75, 80, 85, 90, 95, 100])
    ax.set_xlabel('Score out of 100 (axis starts at 75)', color=t['quiet'], fontsize=10)
    leg = ax.legend(loc='lower left', bbox_to_anchor=(0, 1.0), ncol=3, frameon=False, fontsize=11)
    for tx in leg.get_texts(): tx.set_color(t['ink'])
    fig.tight_layout(); fig.savefig(OUT / f'{name}.png', transparent=t['bg'] == 'none'); plt.close(fig)

def final(name, t):
    c = colours(t); plt.rcParams['font.family'] = t['font']
    fig, ax = plt.subplots(figsize=(9, 3.4) if t['bg'] != 'none' else (6.6, 3.4), dpi=200)
    if t['bg'] != 'none': fig.patch.set_facecolor(t['bg'])
    ax.set_facecolor('none'); style(ax, t)
    for i, m in enumerate(FINAL):
        ax.plot([AVG[m], FINAL[m]], [i, i], color=c[m], lw=1.5, alpha=0.7, zorder=2)
        ax.scatter([AVG[m]], [i], s=110, facecolor='none', edgecolor=c[m], lw=2, zorder=3)
        ax.scatter([FINAL[m]], [i], s=140, color=c[m], zorder=3)
        ax.text(AVG[m], i - 0.28, f'{AVG[m]:.2f}', ha='center', fontsize=10.5, color=t['quiet'])
        ax.text(FINAL[m] + 0.35, i, f'{FINAL[m]}%', va='center', fontsize=12.5, fontweight='bold', color=t['ink'])
    ax.set_yticks(range(3)); ax.set_yticklabels(list(FINAL), color=t['ink'], fontsize=13); ax.invert_yaxis(); ax.set_ylim(2.5, -0.7)
    ax.set_xlim(85, 100); ax.set_xticks([85, 90, 95, 100])
    ax.scatter([], [], s=90, facecolor='none', edgecolor=t['quiet'], lw=2, label='Average of the four experiments')
    ax.scatter([], [], s=90, color=t['quiet'], label='Final overall score')
    leg = ax.legend(loc='lower left', bbox_to_anchor=(0, 1.0), ncol=2, frameon=False, fontsize=11)
    for tx in leg.get_texts(): tx.set_color(t['ink'])
    fig.tight_layout(); fig.savefig(OUT / f'{name}.png', transparent=t['bg'] == 'none'); plt.close(fig)

for k, t in THEMES.items():
    by_test(f'cs_by_test_{k}', t); final(f'cs_final_{k}', t)
print('charts in', OUT)
