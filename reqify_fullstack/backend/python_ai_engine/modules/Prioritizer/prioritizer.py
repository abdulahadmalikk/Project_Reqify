import json
import os
from datetime import datetime
import re
from typing import List, Dict, Tuple, Optional

# ============================================================================
# MOSCOW PRIORITIZER CLASS
# ============================================================================

class MoscowPrioritizer:
    def __init__(self):
        self.moscow_keywords = {
            'Must Have': {
                'must': 3, 'required': 2, 'mandatory': 3, 'essential': 2,
                'critical': 2, 'necessary': 2, 'need': 1, 'shall': 3,
                'require': 2, 'crucial': 2, 'vital': 2, 'compulsory': 3
            },
            'Should Have': {
                'should': 3, 'important': 2, 'recommended': 2, 'ought to': 2,
                'expected': 2, 'preferred': 1, 'desirable': 1
            },
            'Could Have': {
                'could': 3, 'nice to have': 3, 'optional': 3, 'if possible': 2,
                'would like': 2, 'wish': 1, 'maybe': 1, 'possibly': 1, 'might': 2, 'would': 2
            },
            'Won\'t Have': {
                'won\'t': 3, 'won\'t have': 3, 'not required': 2, 'exclude': 2,
                'out of scope': 3, 'future': 2, 'later': 2, 'deferred': 2,
                'next release': 2, 'not in scope': 3, 'wouldn\'t': 3, 'would not': 3
            }
        }

        self.prohibition_patterns = [
            r'\b(shall not|must not|will not|cannot|prohibited from)\b',
            r'\b(shall not permit|must not permit|cannot permit)\b'
        ]

        self.performance_constraint_patterns = [
            r'\b(shall not exceed|must not exceed|will not exceed|cannot exceed)\b',
            r'\b(under|within|below|less than|no more than)\s+\d+',
        ]

        self.future_exclusion_patterns = [
            r'\b(will not.*until|will not.*version|will not.*release)\b',
            r'\b(will not be included until|will not be supported until)\b',
            r'\b(won\'t.*until|won\'t.*version|won\'t.*release)\b',
        ]

        self.context_keywords = {
            'Must Have': {
                'security': 2, 'authenticate': 2, 'authorization': 2, 'encrypt': 3,
                'compliance': 2, 'gdpr': 2, 'hipaa': 2, 'regulation': 2,
                'pci': 2, 'credential': 2, 'password': 2, 'captcha': 3,
                'aes': 3, 'tls': 2, 'ssl': 2, 'hash': 2, 'oauth': 2,
                'login': 2, 'register': 2, 'payment': 2, 'checkout': 2,
                'transaction': 2, 'purchase': 2,
                'backup': 2, 'recovery': 2, 'validation': 2, 'protect': 2,
                'credit card': 3, 'personal data': 3, 'sensitive': 2,
                'expire': 3, 'session': 1, 'timeout': 1, 'lockout': 2,
                'legal': 2, 'privacy': 2, 'terms': 1
            },
            'Should Have': {
                'display': 1, 'show': 1, 'view': 1, 'dashboard': 1,
                'profile': 1, 'settings': 1, 'notification': 1, 'alert': 1,
                'reset': 1, 'email': 1,
                'search': 1, 'filter': 1, 'sort': 1, 'edit': 1, 'update': 1,
                'delete': 1, 'export': 1, 'import': 1, 'report': 1,
                'log': 1, 'audit': 1, 'track': 1, 'monitor': 1,
                'metrics': 1, 'statistics': 1, 'analytics': 1,
                'accessibility': 2, 'wcag': 2, 'standards': 1, 'conform': 1
            },
            'Could Have': {
                'theme': 2, 'customization': 2, 'personalize': 2, 'animation': 2,
                'tooltip': 2, 'help': 1, 'tutorial': 1, 'guide': 1,
                'social': 2, 'share': 1, 'integration': 1, 'api': 1,
                'color': 1, 'font': 1, 'icon': 1, 'logo': 1,
                'advanced': 1, 'insight': 1, 'chart': 1,
                'voice': 2, 'iot': 2, 'ai': 2, 'biometric': 2
            }
        }

        self.priority_weights = {
            'Must Have': 4,
            'Should Have': 3,
            'Could Have': 2,
            'Won\'t Have': 1,
            'Unclassified': 0
        }

        self.confidence_threshold = 0.3

    def is_performance_constraint(self, requirement_text: str) -> bool:
        requirement_lower = requirement_text.lower()
        for pattern in self.performance_constraint_patterns:
            if re.search(pattern, requirement_lower):
                return True
        return False

    def is_future_exclusion(self, requirement_text: str) -> bool:
        requirement_lower = requirement_text.lower()
        for pattern in self.future_exclusion_patterns:
            if re.search(pattern, requirement_lower):
                return True
        return False

    def is_prohibition_requirement(self, requirement_text: str) -> bool:
        requirement_lower = requirement_text.lower()

        if self.is_performance_constraint(requirement_text):
            return False

        if self.is_future_exclusion(requirement_text):
            return False

        for pattern in self.prohibition_patterns:
            if re.search(pattern, requirement_lower):
                return True
        return False

    def suggest_category_by_context(self, requirement_text: str) -> Tuple[str, float, str]:
        requirement_lower = requirement_text.lower()

        category_scores = {category: 0 for category in self.context_keywords}
        matched_context = {category: [] for category in self.context_keywords}

        for category, keywords in self.context_keywords.items():
            for keyword, weight in keywords.items():
                pattern = r'\b' + re.escape(keyword) + r'\b'
                matches = re.findall(pattern, requirement_lower)
                if matches:
                    category_scores[category] += len(matches) * weight
                    matched_context[category].extend(matches)

        max_score = max(category_scores.values())

        if max_score == 0:
            return ('Unclassified', 0.0, 'No contextual indicators found')

        suggested_category = max(category_scores, key=category_scores.get)

        if suggested_category == 'Must Have' and max_score >= 3:
            confidence = min(max_score / 3, 0.8)
        else:
            confidence = min(max_score / 4, 0.5)

        reasoning = f"Context: {', '.join(set(matched_context[suggested_category]))}"

        return (suggested_category, confidence, reasoning)

    def detect_moscow_category(self, requirement_text: str) -> Tuple[str, float, List[str], Dict]:
        requirement_lower = requirement_text.lower()

        if self.is_prohibition_requirement(requirement_text):
            matched_prohibition = []
            for pattern in self.prohibition_patterns:
                matches = re.findall(pattern, requirement_lower)
                if matches:
                    matched_prohibition.extend(matches)

            return ('Must Have', 0.8, matched_prohibition, {
                'is_suggestion': False,
                'is_prohibition': True,
                'reasoning': 'Prohibition requirement (compliance/security constraint)'
            })

        category_scores = {category: 0 for category in self.moscow_keywords}
        matched_keywords = {category: [] for category in self.moscow_keywords}

        for category, keywords in self.moscow_keywords.items():
            for keyword, weight in keywords.items():
                pattern = r'\b' + re.escape(keyword) + r'\b'
                matches = re.findall(pattern, requirement_lower)
                if matches:
                    category_scores[category] += len(matches) * weight
                    matched_keywords[category].extend(matches)

        max_score = max(category_scores.values())

        if max_score == 0:
            suggested_cat, sugg_conf, reasoning = self.suggest_category_by_context(requirement_text)
            return (suggested_cat, sugg_conf, [], {
                'is_suggestion': True,
                'reasoning': reasoning
            })

        detected_category = max(category_scores, key=category_scores.get)
        confidence = min(max_score / 5, 1.0)

        suggestion_info = {
            'is_suggestion': False
        }

        return (detected_category, confidence, matched_keywords[detected_category], suggestion_info)

    def prioritize_requirements(self, requirements: List[str]) -> List[Dict]:
        prioritized_reqs = []

        for idx, req in enumerate(requirements):
            if not isinstance(req, str) or not req.strip():
                continue

            category, confidence, keywords, suggestion_info = self.detect_moscow_category(req)

            needs_review = (
                confidence < self.confidence_threshold or
                category == 'Unclassified' or
                suggestion_info.get('is_suggestion', False)
            )

            result = {
                'req_id': f"REQ-{str(idx + 1).zfill(3)}",
                'requirement': req.strip(),
                'moscow_category': category,
                'confidence': round(confidence, 2),
                'matched_keywords': list(set(keywords)),
                'priority_weight': self.priority_weights[category],
                'needs_review': needs_review,
                'is_suggested': suggestion_info.get('is_suggestion', False)
            }

            if suggestion_info.get('is_suggestion'):
                result['suggestion_reasoning'] = suggestion_info.get('reasoning', '')

            if suggestion_info.get('is_prohibition'):
                result['is_prohibition'] = True
                result['prohibition_reasoning'] = suggestion_info.get('reasoning', '')

            prioritized_reqs.append(result)

        prioritized_reqs.sort(key=lambda x: (x['priority_weight'], x['confidence']), reverse=True)

        for rank, req in enumerate(prioritized_reqs, start=1):
            req['rank'] = rank

        return prioritized_reqs


# ============================================================================
# HYBRID PRIORITIZER CLASS
# ============================================================================

class HybridPrioritizer:
    def __init__(self):
        self.base_priority_scores = {
            'Must Have': 100,
            'Should Have': 75,
            'Could Have': 50,
            'Won\'t Have': 25,
            'Unclassified': 0
        }

        self.ambiguity_penalty_weight = 30
        self.conflict_penalty_weight = 30

    def load_ambiguity_results(self, ambiguity_file_path: str) -> Dict:
        try:
            with open(ambiguity_file_path, 'r') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            print(f"Warning: Could not load ambiguity file: {e}")
            return {}

    def load_conflict_results(self, conflict_file_path: str) -> Dict:
        try:
            with open(conflict_file_path, 'r') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            print(f"Warning: Could not load conflict file: {e}")
            return {}

    def extract_ambiguity_score(self, req_text: str, ambiguity_data: Dict) -> float:
        if not ambiguity_data or 'results' not in ambiguity_data:
            return 0.0

        for result in ambiguity_data.get('results', []):
            if result.get('requirement', '').strip() == req_text.strip():
                return result.get('ambiguity_score', 0.0)

        return 0.0

    def extract_conflict_score(self, req_index: int, req_text: str, conflict_data: Dict) -> float:
        if not conflict_data or 'results' not in conflict_data:
            return 0.0

        max_conflict_score = 0.0

        for result in conflict_data.get('results', []):
            for detection in result.get('detections', []):
                req1_id = detection.get('req1_id')
                req2_id = detection.get('req2_id')

                if req1_id == req_index or req2_id == req_index:
                    confidence = detection.get('confidence', 0.0)
                    issue_type = detection.get('issue_type', '')

                    conflict_weight = {
                        'contradiction': 1.0,
                        'duplicate': 0.7,
                        'inconsistency': 0.5
                    }.get(issue_type, 0.5)

                    weighted_score = confidence * conflict_weight
                    max_conflict_score = max(max_conflict_score, weighted_score)

        return max_conflict_score

    def calculate_hybrid_score(self, moscow_category: str, ambiguity_score: float,
                               conflict_score: float) -> Dict:
        base_score = self.base_priority_scores.get(moscow_category, 0)

        ambiguity_penalty = ambiguity_score * self.ambiguity_penalty_weight
        conflict_penalty = conflict_score * self.conflict_penalty_weight

        final_score = max(0, base_score - ambiguity_penalty - conflict_penalty)

        return {
            'base_score': base_score,
            'ambiguity_penalty': round(ambiguity_penalty, 2),
            'conflict_penalty': round(conflict_penalty, 2),
            'final_score': round(final_score, 2),
            'quality_rating': self._get_quality_rating(ambiguity_score, conflict_score)
        }

    def _get_quality_rating(self, ambiguity_score: float, conflict_score: float) -> str:
        total_issues = ambiguity_score + conflict_score

        if total_issues < 0.3:
            return "Excellent"
        elif total_issues < 0.6:
            return "Good"
        elif total_issues < 1.0:
            return "Fair"
        else:
            return "Poor"

    def refine_prioritization(self, moscow_results: List[Dict],
                             ambiguity_data: Optional[Dict] = None,
                             conflict_data: Optional[Dict] = None) -> List[Dict]:

        ambiguity_data = ambiguity_data or {}
        conflict_data = conflict_data or {}

        refined_results = []

        for idx, req in enumerate(moscow_results):
            req_text = req.get('requirement', '')
            moscow_category = req.get('moscow_category', 'Unclassified')

            ambiguity_score = self.extract_ambiguity_score(req_text, ambiguity_data)
            conflict_score = self.extract_conflict_score(idx, req_text, conflict_data)

            score_breakdown = self.calculate_hybrid_score(
                moscow_category,
                ambiguity_score,
                conflict_score
            )

            refined_req = {
                **req,
                'ambiguity_score': round(ambiguity_score, 3),
                'conflict_score': round(conflict_score, 3),
                'has_ambiguity': ambiguity_score > 0.3,
                'has_conflict': conflict_score > 0.3,
                'quality_issues': [],
                **score_breakdown
            }

            if ambiguity_score > 0.3:
                refined_req['quality_issues'].append(
                    f"Ambiguity detected (score: {ambiguity_score:.2f})"
                )
            if conflict_score > 0.3:
                refined_req['quality_issues'].append(
                    f"Conflict detected (score: {conflict_score:.2f})"
                )

            refined_results.append(refined_req)

        category_order = {'Must Have': 0, 'Should Have': 1, 'Could Have': 2,
                         'Won\'t Have': 3, 'Unclassified': 4}

        refined_results.sort(
            key=lambda x: (
                category_order.get(x['moscow_category'], 999),
                -x['final_score']
            )
        )

        for rank, req in enumerate(refined_results, start=1):
            req['final_rank'] = rank

            category_reqs = [r for r in refined_results if r['moscow_category'] == req['moscow_category']]
            category_rank = category_reqs.index(req) + 1
            req['category_rank'] = f"{category_rank}/{len(category_reqs)}"

        return refined_results

    def generate_report(self, refined_results: List[Dict]) -> str:
        report = "="*100 + "\n"
        report += "HYBRID PRIORITIZATION REPORT (MoSCoW + Ambiguity + Conflict)\n"
        report += "="*100 + "\n\n"

        for category in ['Must Have', 'Should Have', 'Could Have', 'Won\'t Have', 'Unclassified']:
            category_reqs = [r for r in refined_results if r['moscow_category'] == category]

            if category_reqs:
                report += f"\n{'='*100}\n"
                report += f"{category.upper()} ({len(category_reqs)} requirements)\n"
                report += f"{'='*100}\n"

                for req in category_reqs:
                    report += f"\n{req['req_id']} | Rank: #{req['final_rank']} (Category: {req['category_rank']}) | "
                    report += f"Final Score: {req['final_score']:.1f}/100\n"
                    report += f"Requirement: {req['requirement'][:80]}...\n" if len(req['requirement']) > 80 else f"Requirement: {req['requirement']}\n"

                    report += f"├─ Base Priority: {req['base_score']}\n"
                    report += f"├─ Ambiguity Penalty: -{req['ambiguity_penalty']:.1f} "
                    report += f"(score: {req['ambiguity_score']:.2f})\n"
                    report += f"├─ Conflict Penalty: -{req['conflict_penalty']:.1f} "
                    report += f"(score: {req['conflict_score']:.2f})\n"
                    report += f"└─ Quality Rating: {req['quality_rating']}\n"

                    if req['quality_issues']:
                        report += "⚠️  QUALITY ISSUES:\n"
                        for issue in req['quality_issues']:
                            report += f"   • {issue}\n"

                    if req.get('needs_review'):
                        report += "🔍 NEEDS MANUAL REVIEW\n"

                    report += "\n"

        report += "\n" + "="*100 + "\n"
        report += "SUMMARY STATISTICS\n"
        report += "="*100 + "\n"

        total = len(refined_results)
        for category in ['Must Have', 'Should Have', 'Could Have', 'Won\'t Have', 'Unclassified']:
            count = len([r for r in refined_results if r['moscow_category'] == category])
            if count > 0:
                percentage = (count/total)*100
                avg_score = sum(r['final_score'] for r in refined_results if r['moscow_category'] == category) / count
                report += f"{category}: {count} ({percentage:.1f}%) - Avg Score: {avg_score:.1f}\n"

        has_ambiguity = len([r for r in refined_results if r['has_ambiguity']])
        has_conflict = len([r for r in refined_results if r['has_conflict']])
        excellent = len([r for r in refined_results if r['quality_rating'] == 'Excellent'])
        poor = len([r for r in refined_results if r['quality_rating'] == 'Poor'])

        report += f"\nQuality Metrics:\n"
        report += f"  Requirements with Ambiguity: {has_ambiguity} ({has_ambiguity/total*100:.1f}%)\n"
        report += f"  Requirements with Conflicts: {has_conflict} ({has_conflict/total*100:.1f}%)\n"
        report += f"  Excellent Quality: {excellent} ({excellent/total*100:.1f}%)\n"
        report += f"  Poor Quality: {poor} ({poor/total*100:.1f}%)\n"

        return report


# ============================================================================
# MAIN EXECUTION
# ============================================================================

if __name__ == "__main__":
    # Sample requirements
    test_requirements = [
        "The system shall encrypt all user passwords using bcrypt with a cost factor of 12",
        "The system should provide reliable notifications with 99% delivery rate",
        "Users could customize their dashboard themes",
        "The system will not store credit card CVV numbers",
        "The application must authenticate users within 2 seconds",
        "User sessions automatically expire after 15 minutes of inactivity",
        "CAPTCHA on registration form",
        "Database connections utilize AES-256 encryption for data at rest",
    ]

    print("="*100)
    print("STEP 1: MoSCoW CLASSIFICATION")
    print("="*100)

    # Step 1: MoSCoW Classification
    moscow = MoscowPrioritizer()
    moscow_results = moscow.prioritize_requirements(test_requirements)

    print(f"\nClassified {len(moscow_results)} requirements")

    # Display MoSCoW results
    for req in moscow_results[:5]:  # Show first 5
        print(f"\n{req['req_id']}: {req['moscow_category']} (Confidence: {req['confidence']*100:.0f}%)")
        print(f"  {req['requirement'][:60]}...")

    print("\n" + "="*100)
    print("STEP 2: HYBRID PRIORITIZATION (with Ambiguity & Conflict)")
    print("="*100)

    # Step 2: Hybrid Refinement
    # NOTE: Update these paths to your actual ambiguity and conflict JSON files
    ambiguity_file = None  # e.g., "./ambiguity_results.json"
    conflict_file = None   # e.g., "./conflict_results.json"

    hybrid = HybridPrioritizer()
    refined_results = hybrid.refine_prioritization(
        moscow_results,
        ambiguity_file=ambiguity_file,
        conflict_file=conflict_file
    )

    # Step 3: Generate Report
    report = hybrid.generate_report(refined_results)
    print(report)

    # Save results to JSON
    output_data = {
        'metadata': {
            'total_requirements': len(refined_results),
            'timestamp': datetime.now().isoformat(),
            'method': 'Hybrid_MoSCoW_Ambiguity_Conflict'
        },
        'requirements': refined_results
    }

    with open('hybrid_prioritization_results.json', 'w') as f:
        json.dump(output_data, f, indent=2)

    print("\n✅ Results saved to 'hybrid_prioritization_results.json'")

