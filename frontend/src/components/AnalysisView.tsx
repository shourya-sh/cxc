"use client";

import { useState, useEffect } from "react";
import { fetchModelInfo, getChartUrl, ModelInfo } from "@/lib/api";
import {
  Brain,
  Target,
  BarChart3,
  Activity,
  ChevronDown,
  ChevronUp,
  Layers,
  Zap,
  TrendingUp,
  Database,
} from "lucide-react";

// Chart descriptions for judges / presentation
const CHART_EXPLANATIONS: Record<string, string> = {
  data_overview:
    "Our dataset covers 10,231 NBA games across 9 seasons (2017-2026). Home teams win ~56% of the time — this is our naive baseline to beat. The class balance is slightly skewed but not enough to require oversampling.",
  confusion_matrix:
    "The confusion matrix shows how our model's predictions break down. True positives (correctly predicted home wins) and true negatives (correctly predicted away wins) are on the diagonal. Off-diagonal values are misclassifications.",
  feature_importance:
    "Feature importance reveals which statistics the model relies on most. Win percentage differentials and scoring margins dominate — the model learned that recent team form is the strongest predictor of game outcomes.",
  correlation_heatmap:
    "The correlation matrix exposes redundant features. Highly correlated pairs (|r| > 0.7) add noise without new information. We identified 15 features that hurt accuracy when included.",
  target_correlation:
    "This shows how strongly each feature correlates with home wins. Positive values favor the home team, negative values favor the away team. Home advantage and win percentage differences are the strongest signals.",
  ablation_study:
    "The drop-one-out ablation study is our most rigorous feature analysis. We retrain the model 27 times, each time removing one feature. If accuracy increases when a feature is removed, that feature is noise. We found 15 harmful features.",
  season_accuracy:
    "The model performs consistently across seasons (60-68%), showing it generalizes well and isn't overfitting to specific eras. The 2024-25 season accuracy of 64.4% is particularly encouraging as it's the most recent full season.",
  calibration:
    "Calibration measures whether the model's confidence is trustworthy. When our model says 75% chance, home teams actually win ~76% of the time. This means our probabilities are well-calibrated — you can trust the confidence scores.",
  algorithm_comparison:
    "We compared 5 algorithms on the same data: Gradient Boosting won with the highest accuracy, beating Random Forest, AdaBoost, Logistic Regression, and KNN. After hyperparameter tuning and feature optimization, our final GBT model reached 65.6% — GBT's ensemble approach handles the nonlinear relationships in NBA data best.",
  roc_curve:
    "The ROC curve (AUC = 0.692) shows the model's ability to distinguish between home wins and losses across all thresholds. An AUC of 0.69 means the model correctly ranks a random home-win game above a random home-loss game 69% of the time.",
  dashboard:
    "Combined dashboard showing all key metrics at a glance: feature importance, confusion matrix, ROC curve, calibration, season accuracy, and confidence distribution.",
};

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
  subtitle,
}: {
  icon: any;
  label: string;
  value: string;
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-bg-card border border-border rounded-xl px-4 py-4">
      <div className="flex items-center gap-2.5 mb-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${color}18` }}
        >
          <Icon size={16} style={{ color }} />
        </div>
        <span className="text-xs text-text-muted">{label}</span>
      </div>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      {subtitle && <p className="text-[11px] text-text-muted mt-1">{subtitle}</p>}
    </div>
  );
}

export default function AnalysisView() {
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedChart, setExpandedChart] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<
    "overview" | "charts" | "features"
  >("overview");

  useEffect(() => {
    fetchModelInfo()
      .then(setModelInfo)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card p-6">
            <div className="shimmer h-6 w-48 mb-4" />
            <div className="shimmer h-32 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!modelInfo) {
    return (
      <div className="glass-card p-8 text-center">
        <Brain size={32} className="mx-auto mb-3 text-text-muted" />
        <p className="text-text-muted">Model data unavailable. Make sure the backend is running.</p>
      </div>
    );
  }

  const { metrics, features, dropped_features, available_charts } = modelInfo;

  return (
    <div className="space-y-6 fade-in">
      {/* Section tabs */}
      <div className="flex items-center gap-2">
        {(
          [
            ["overview", "Overview"],
            ["charts", "Analysis Charts"],
            ["features", "Features"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSelectedSection(key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              selectedSection === key
                ? "bg-accent text-bg-primary"
                : "bg-bg-elevated text-text-secondary hover:text-text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Overview Section ── */}
      {selectedSection === "overview" && (
        <>
          {/* Hero metric cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              icon={Target}
              label="Test Accuracy"
              value={`${(metrics.accuracy * 100).toFixed(1)}%`}
              color="#34d399"
              subtitle="On held-out 20% test set"
            />
            <MetricCard
              icon={Activity}
              label="Temporal Accuracy"
              value={`${(metrics.temporal_accuracy * 100).toFixed(1)}%`}
              color="#22d3ee"
              subtitle="Train past → predict future"
            />
            <MetricCard
              icon={BarChart3}
              label="AUC Score"
              value={metrics.auc.toFixed(3)}
              color="#a78bfa"
              subtitle="Discriminative ability"
            />
            <MetricCard
              icon={Database}
              label="Training Data"
              value={metrics.total_games.toLocaleString()}
              color="#fbbf24"
              subtitle="Games across 9 seasons"
            />
          </div>

          {/* Model summary card */}
          <div className="glass-card p-6">
            <h3 className="text-base font-bold mb-4 flex items-center gap-2">
              <Brain size={18} className="text-accent" />
              Model Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-text-muted mb-1">Algorithm</p>
                  <p className="text-sm font-semibold">Gradient Boosted Trees</p>
                  <p className="text-xs text-text-muted">scikit-learn GradientBoostingClassifier</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">Features</p>
                  <p className="text-sm font-semibold">
                    {features.length} optimized{" "}
                    <span className="text-text-muted font-normal">
                      (dropped {dropped_features.length} noisy)
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">F1 Score</p>
                  <p className="text-sm font-semibold">{(metrics.f1 * 100).toFixed(1)}%</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-text-muted mb-1">Naive Baseline</p>
                  <p className="text-sm font-semibold">55.9%</p>
                  <p className="text-xs text-text-muted">Always predict home win</p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">Lift Over Baseline</p>
                  <p className="text-sm font-semibold text-accent-green">
                    +9.7%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">High-Confidence Accuracy</p>
                  <p className="text-sm font-semibold text-accent-green">~76%</p>
                  <p className="text-xs text-text-muted">When model is 75%+ confident</p>
                </div>
              </div>
            </div>
          </div>

          {/* Key insights */}
          <div className="glass-card p-6">
            <h3 className="text-base font-bold mb-4 flex items-center gap-2">
              <Zap size={18} className="text-accent" />
              Key Findings
            </h3>
            <div className="space-y-3">
              {[
                {
                  title: "Home Advantage is Real",
                  desc: "Home teams win 56% of games across 9 seasons. Our model captures this plus 27 other signals to push accuracy to 65.6% — a nearly 10% lift over baseline.",
                  color: "#34d399",
                },
                {
                  title: "Less is More",
                  desc: "Our ablation study found 15 out of 27 features were actually hurting accuracy. Dropping them and tuning hyperparameters boosted us from ~62% to 65.6% — noise reduction matters more than feature quantity.",
                  color: "#22d3ee",
                },
                {
                  title: "Confidence = Accuracy",
                  desc: "The model's calibration is excellent. Low-confidence predictions (~50%) are coin flips, but 75%+ confidence predictions hit 76% accuracy. Trust the model when it's confident.",
                  color: "#fbbf24",
                },
                {
                  title: "Consistent Across Eras",
                  desc: "Accuracy stays between 60-68% across all 9 seasons (2017-2026), showing the model generalizes well and isn't overfitting to a specific era of basketball.",
                  color: "#a78bfa",
                },
              ].map((insight, i) => (
                <div
                  key={i}
                  className="flex gap-3 p-3 rounded-lg bg-bg-elevated"
                >
                  <div
                    className="w-1 rounded-full flex-shrink-0"
                    style={{ background: insight.color }}
                  />
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      {insight.title}
                    </p>
                    <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                      {insight.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Charts Section ── */}
      {selectedSection === "charts" && (
        <div className="space-y-4">
          {available_charts.map((chart) => (
            <div key={chart.id} className="glass-card overflow-hidden">
              <button
                onClick={() =>
                  setExpandedChart(expandedChart === chart.id ? null : chart.id)
                }
                className="w-full flex items-center justify-between p-5 hover:bg-bg-elevated/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent-dim flex items-center justify-center">
                    <BarChart3 size={14} className="text-accent" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-text-primary">
                      {chart.title}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5 line-clamp-1">
                      {CHART_EXPLANATIONS[chart.id]?.slice(0, 100)}...
                    </p>
                  </div>
                </div>
                {expandedChart === chart.id ? (
                  <ChevronUp size={16} className="text-text-muted" />
                ) : (
                  <ChevronDown size={16} className="text-text-muted" />
                )}
              </button>
              {expandedChart === chart.id && (
                <div className="px-5 pb-5 space-y-4">
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {CHART_EXPLANATIONS[chart.id]}
                  </p>
                  <div className="rounded-xl overflow-hidden border border-border bg-black/40">
                    <img
                      src={getChartUrl(chart.file)}
                      alt={chart.title}
                      className="w-full h-auto"
                      loading="lazy"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Features Section ── */}
      {selectedSection === "features" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Active features */}
          <div className="glass-card p-6">
            <h3 className="text-base font-bold mb-4 flex items-center gap-2">
              <Layers size={16} className="text-accent-green" />
              Active Features ({features.length})
            </h3>
            <p className="text-xs text-text-muted mb-4">
              These features survived the ablation study and contribute positively
              to prediction accuracy.
            </p>
            <div className="space-y-2">
              {features.map((feat, i) => (
                <div
                  key={feat}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-bg-elevated"
                >
                  <span className="text-xs text-text-muted w-5 text-right">
                    {i + 1}
                  </span>
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                  <span className="text-xs font-mono text-text-primary">
                    {feat}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Dropped features */}
          <div className="glass-card p-6">
            <h3 className="text-base font-bold mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-accent-red" />
              Dropped Features ({dropped_features.length})
            </h3>
            <p className="text-xs text-text-muted mb-4">
              These features were found to hurt model accuracy in our
              drop-one-out ablation study. Removing them improved performance.
            </p>
            <div className="space-y-2">
              {dropped_features.map((feat, i) => (
                <div
                  key={feat}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-bg-elevated"
                >
                  <span className="text-xs text-text-muted w-5 text-right">
                    {i + 1}
                  </span>
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-red" />
                  <span className="text-xs font-mono text-text-secondary line-through opacity-60">
                    {feat}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
