"""
REQIFY v13.4 – Full NLP-Based Component Extraction
IMPROVEMENTS:
- NLP-based action detection (beyond modal verbs)
- NLP-based target detection (beyond direct objects)
- NLP-based actor detection (no dictionary dependency)
- NLP-based constraint detection (4+ detection strategies)
- Intelligently identifies all components based on grammatical roles
- Multiple detection strategies with fallback mechanisms
"""

import spacy
import re
from typing import List, Dict, Set, Tuple
from dataclasses import dataclass, asdict
import pandas as pd
from collections import deque


@dataclass
class RequirementComponent:
    requirement_id: str = ""
    original_requirement: str = ""
    segmented_statement: str = ""
    localization: str = "Not detected"
    localization_lemmatized: str = "Not detected"
    localization_cleaned: str = "Not detected"
    actor: str = "Not detected"
    actor_lemmatized: str = "Not detected"
    actor_cleaned: str = "Not detected"
    action: str = "Not detected"
    action_lemmatized: str = "Not detected"
    action_cleaned: str = "Not detected"
    target: str = "Not detected"
    target_lemmatized: str = "Not detected"
    target_cleaned: str = "Not detected"
    constraint: str = "Not detected"
    constraint_lemmatized: str = "Not detected"
    constraint_cleaned: str = "Not detected"
    confidence: float = 0.0
    extraction_method: str = "hybrid"
    is_atomic: bool = True
    atomicity_score: float = 1.0
    atomicity_violations: str = "None"


class AdvancedHybridExtractor:
    def __init__(self, model_name: str = "en_core_web_sm"):
        try:
            self.nlp = spacy.load(model_name)
            print(f"spaCy model '{model_name}' loaded successfully\n")
        except OSError:
            print(f"Model '{model_name}' not found. Installing...")
            import os
            os.system(f"python -m spacy download {model_name}")
            self.nlp = spacy.load(model_name)

        self.modal_verbs = {"shall", "will", "must", "should", "may", "can", "could", "would", "is to", "are to"}

        # Words that should NOT be considered actors
        self.non_actor_words = {
            "it", "this", "that", "these", "those", "there", "here",
            "all", "any", "some", "each", "every", "none", "nothing",
            "something", "anything", "everything", "someone", "anyone"
        }

        self.purpose_markers = {
            "to ensure", "to maintain", "to provide", "to enable", "to support",
            "to allow", "to guide", "to guarantee", "to facilitate", "to prevent",
            "in order to", "so as to", "for the purpose of", "to help", "to assist",
            "to improve", "to enhance", "to optimize", "to minimize", "to maximize",
            "so that", "in order that"
        }

        self.platforms = {
            "windows", "window", "linux", "mac os", "macos", "mac", "unix", "android", "ios",
            "ubuntu", "debian", "centos", "fedora", "redhat", "solaris", "freebsd", "aix", "platform"
        }

        self.time_units = {
            "second", "seconds", "minute", "minutes", "hour", "hours", "day", "days",
            "week", "weeks", "month", "months", "year", "years", "ms", "sec", "min", "hr"
        }
        self.quantity_units = {"percent", "%", "bytes", "kb", "mb", "gb", "tb", "ram", "memory", "cpu", "disk"}
        self.all_units = self.time_units.union(self.quantity_units)

        self.combinatorial_words = {
            "and", "or", "both", "either", "as well as", "along with",
            "together with", "in addition to", "plus", "also"
        }

        self.auxiliary_verbs = {
            "be", "is", "are", "was", "were", "been", "being",
            "have", "has", "had", "having",
            "do", "does", "did", "doing"
        }

        # Common non-action verbs to filter out
        self.non_action_verbs = {
            "be", "is", "are", "was", "were", "am", "been", "being",
            "have", "has", "had", "having",
            "do", "does", "did"
        }

    def validate_atomicity(self, doc, text: str, action_component: str, target_component: str) -> Tuple[bool, float, str]:
        """Enhanced atomicity validation"""
        violations = []
        penalty = 0.0
        text_lower = text.lower()

        # RULE 1: Multiple distinct action verbs
        if action_component != "Not detected":
            actions = [a.strip() for a in action_component.split(",") if a.strip()]
            if len(actions) > 1:
                distinct_actions = [a for a in actions if a not in self.auxiliary_verbs]
                if len(distinct_actions) > 1:
                    violations.append(f"Multiple actions: {', '.join(distinct_actions)}")
                    penalty += 0.5

        # RULE 2: Multiple gerund actions
        gerund_pattern = r'\b(?:capable of|responsible for|in charge of|engaged in|involved in)\s+([\w\s,]+(?:and|or)[\w\s,]+)'
        gerund_matches = re.finditer(gerund_pattern, text_lower)

        gerund_actions = []
        for match in gerund_matches:
            gerund_phrase = match.group(1)
            individual_gerunds = re.findall(r'\b(\w+ing)\b', gerund_phrase)
            gerund_actions.extend(individual_gerunds)

        for token in doc:
            if (token.tag_ == "VBG" or (token.pos_ == "NOUN" and token.text.endswith("ing"))) and \
               token.dep_ in {"pobj", "xcomp", "dobj", "conj"}:
                if token.text.lower() not in {"being", "having", "doing"}:
                    gerund_actions.append(token.text)

                    for child in token.children:
                        if child.dep_ == "conj" and (child.tag_ == "VBG" or child.text.endswith("ing")):
                            if child.text.lower() not in {"being", "having", "doing"}:
                                gerund_actions.append(child.text)

        unique_gerunds = list(set(gerund_actions))
        if len(unique_gerunds) >= 2:
            violations.append(f"Multiple gerund actions: {', '.join(unique_gerunds)}")
            penalty += 0.5

        # RULE 3: Multiple coordinated NOUN targets
        if action_component != "Not detected" and target_component != "Not detected":
            coordinated_targets = []

            for token in doc:
                if token.pos_ == "VERB" and token.lemma_ in action_component.lower():
                    dobjs = [child for child in token.children if child.dep_ == "dobj"]

                    for dobj in dobjs:
                        targets_in_coord = [dobj.text]

                        for child in dobj.children:
                            if child.dep_ == "conj" and child.pos_ in {"NOUN", "PROPN"}:
                                targets_in_coord.append(child.text)

                        if len(targets_in_coord) >= 2:
                            coordinated_targets.extend(targets_in_coord)

            target_coord_pattern = r'\b(\w+)\s+(?:and|or)\s+(\w+\s+\w+|\w+)\b'
            for match in re.finditer(target_coord_pattern, text):
                target1, target2 = match.groups()
                doc_match = self.nlp(f"{target1} and {target2}")
                nouns_found = [t.text for t in doc_match if t.pos_ in {"NOUN", "PROPN"}]
                if len(nouns_found) >= 2:
                    coordinated_targets.extend(nouns_found[:2])

            unique_targets = list(set(coordinated_targets))
            if len(unique_targets) >= 2:
                meaningful_targets = [t for t in unique_targets if len(t) > 2 and t.lower() not in {"the", "and", "or"}]

                if len(meaningful_targets) >= 2:
                    violations.append(f"Multiple coordinated targets: {', '.join(meaningful_targets)}")
                    penalty += 0.5

        # RULE 4: Conjoined verb phrases
        verb_tokens = [t for t in doc if t.pos_ == "VERB" and t.lemma_ not in self.auxiliary_verbs]

        for i, verb in enumerate(verb_tokens):
            for child in verb.children:
                if child.dep_ == "cc" and child.text.lower() in self.combinatorial_words:
                    for sibling in verb.children:
                        if sibling.dep_ == "conj" and sibling.pos_ == "VERB":
                            if not self._is_subordinate_action(verb, sibling, doc):
                                violations.append(f"Conjoined actions via '{child.text}': {verb.text} {child.text} {sibling.text}")
                                penalty += 0.4

        # RULE 5: Multiple platforms
        platform_matches = []

        for platform in self.platforms:
            pattern = r'\b' + re.escape(platform) + r'\b'
            if re.search(pattern, text_lower):
                if platform == "platform":
                    if not any(p != "platform" for p in platform_matches):
                        platform_matches.append(platform)
                else:
                    platform_matches.append(platform)

        if len(platform_matches) >= 2:
            platform_matches = [p for p in platform_matches if p != "platform" or len(platform_matches) == 1]

            if len(platform_matches) >= 2:
                has_coordination = False
                coordinated_platforms = []

                for i, plat1 in enumerate(platform_matches):
                    for plat2 in platform_matches[i+1:]:
                        coord_pattern = rf'{re.escape(plat1)}[,\s]+(and|or|as well as)\s+{re.escape(plat2)}'
                        coord_pattern_rev = rf'{re.escape(plat2)}[,\s]+(and|or|as well as)\s+{re.escape(plat1)}'
                        list_pattern = rf'{re.escape(plat1)}\s*,\s*{re.escape(plat2)}'
                        list_pattern_rev = rf'{re.escape(plat2)}\s*,\s*{re.escape(plat1)}'

                        if (re.search(coord_pattern, text_lower) or
                            re.search(coord_pattern_rev, text_lower) or
                            re.search(list_pattern, text_lower) or
                            re.search(list_pattern_rev, text_lower)):
                            has_coordination = True
                            if plat1 not in coordinated_platforms:
                                coordinated_platforms.append(plat1)
                            if plat2 not in coordinated_platforms:
                                coordinated_platforms.append(plat2)

                if has_coordination and coordinated_platforms:
                    violations.append(f"Multiple platforms/targets: {', '.join(coordinated_platforms)}")
                    penalty += 0.5

        # RULE 6: Multiple technologies
        tech_pattern = r'\b([A-Z][A-Za-z0-9]*|[A-Z]{2,})\s*(?:,\s*(?:and|or)\s+|(?:and|or)\s+|,\s+)([A-Z][A-Za-z0-9]*|[A-Z]{2,})'
        tech_matches = re.findall(tech_pattern, text)

        if tech_matches:
            valid_tech_pairs = []
            seen_techs = set()

            for tech1, tech2 in tech_matches:
                common_words = {"The", "A", "An", "This", "That", "These", "Those", "All", "Any", "Some", "When", "If"}

                if tech1 not in common_words and tech2 not in common_words:
                    if (len(tech1) <= 15 and (tech1.isupper() or tech1[0].isupper())) and \
                       (len(tech2) <= 15 and (tech2.isupper() or tech2[0].isupper())):
                        tech_pair = tuple(sorted([tech1, tech2]))
                        if tech_pair not in seen_techs:
                            seen_techs.add(tech_pair)
                            valid_tech_pairs.append(f"{tech1}, {tech2}")

            if valid_tech_pairs and len(action_component.split(",")) <= 1:
                if "Multiple platforms/targets" not in str(violations):
                    violations.append(f"Multiple technologies/formats: {' | '.join(valid_tech_pairs)}")
                    penalty += 0.4

        atomicity_score = max(0.0, 1.0 - penalty)
        is_atomic = atomicity_score >= 0.7

        violations_str = " | ".join(violations) if violations else "None"

        return is_atomic, round(atomicity_score, 2), violations_str

    def _is_subordinate_action(self, main_verb, conj_verb, doc) -> bool:
        for token in conj_verb.subtree:
            if token.text.lower() in {"to", "for", "in order"}:
                return True
        for child in main_verb.children:
            if child.text.lower() in self.modal_verbs:
                return True
        return False

    def lemmatize_component(self, text: str) -> str:
        if text == "Not detected" or not text:
            return "Not detected"

        items = [item.strip() for item in text.split(",")]
        lemmatized_items = []

        for item in items:
            doc = self.nlp(item)
            lemmas = []

            for token in doc:
                if token.pos_ in {"PROPN", "NUM"} or token.text.isupper():
                    lemmas.append(token.text)
                elif token.text.lower() in self.modal_verbs:
                    lemmas.append(token.text.lower())
                else:
                    lemma = token.lemma_.lower() if token.lemma_ != "-PRON-" else token.text.lower()
                    lemmas.append(lemma)

            lemmatized_items.append(" ".join(lemmas))

        return ", ".join(lemmatized_items)

    def remove_stop_words(self, text: str) -> str:
        if text == "Not detected" or not text:
            return "Not detected"

        items = [item.strip() for item in text.split(",")]
        cleaned_items = []

        for item in items:
            doc = self.nlp(item)
            tokens_to_keep = []

            for token in doc:
                if not token.is_stop:
                    tokens_to_keep.append(token.text)
                    continue

                if token.dep_ in {"nsubj", "nsubjpass", "ROOT", "dobj", "pobj",
                                   "aux", "auxpass", "prep", "advmod", "neg",
                                   "acomp", "attr", "agent"}:
                    tokens_to_keep.append(token.text)
                    continue

                if token.dep_ == "cc" and token.head.dep_ in {"ROOT", "conj", "dobj", "pobj"}:
                    tokens_to_keep.append(token.text)
                    continue

                if token.pos_ == "ADP" and token.dep_ in {"prep", "prt"}:
                    tokens_to_keep.append(token.text)
                    continue

                if token.pos_ == "DET":
                    if token.i + 1 < len(doc):
                        next_token = doc[token.i + 1]
                        if next_token.pos_ in {"PROPN", "NUM"} or next_token.text.isupper():
                            tokens_to_keep.append(token.text)
                            continue

                if token.text.lower() in self.modal_verbs:
                    tokens_to_keep.append(token.text)
                    continue

                if token.dep_ == "neg" or token.text.lower() in {"not", "no", "never"}:
                    tokens_to_keep.append(token.text)
                    continue

                if token.pos_ == "DET" and token.text.lower() in {"all", "any", "some", "every", "each"}:
                    tokens_to_keep.append(token.text)
                    continue

            if tokens_to_keep:
                cleaned_items.append(" ".join(tokens_to_keep))

        result = ", ".join(cleaned_items)
        return result if result else "Not detected"

    def extract_components(self, requirement: str, req_id: str = "") -> RequirementComponent:
        doc = self.nlp(requirement.strip())
        comp = RequirementComponent(
            requirement_id=req_id,
            original_requirement=requirement
        )

        comp.constraint = self._extract_constraint(doc, requirement)
        comp.localization = self._extract_localization(requirement, comp.constraint)
        comp.action = self._extract_action_nlp(doc, requirement, comp.constraint)
        comp.target = self._extract_target_nlp(doc, comp.action, comp.localization, comp.constraint, requirement)
        comp.actor = self._extract_actor(doc, comp.localization, comp.target)
        comp.confidence = self._calculate_confidence(comp)

        comp.is_atomic, comp.atomicity_score, comp.atomicity_violations = self.validate_atomicity(
            doc, requirement, comp.action, comp.target
        )

        comp.localization_lemmatized = self.lemmatize_component(comp.localization)
        comp.actor_lemmatized = self.lemmatize_component(comp.actor)
        comp.action_lemmatized = self.lemmatize_component(comp.action)
        comp.target_lemmatized = self.lemmatize_component(comp.target)
        comp.constraint_lemmatized = self.lemmatize_component(comp.constraint)

        comp.localization_cleaned = self.remove_stop_words(comp.localization_lemmatized)
        comp.actor_cleaned = self.remove_stop_words(comp.actor_lemmatized)
        comp.action_cleaned = self.remove_stop_words(comp.action_lemmatized)
        comp.target_cleaned = self.remove_stop_words(comp.target_lemmatized)
        comp.constraint_cleaned = self.remove_stop_words(comp.constraint_lemmatized)

        return comp

    def _extract_constraint(self, doc, text: str) -> str:
        """
        ENHANCED: NLP-based constraint detection with proper duplicate handling
        """
        constraints = []  # Use list to maintain order
        seen_normalized = set()  # Track normalized versions
        seen_spans = []  # Track character spans to avoid overlaps

        def add_constraint(phrase: str, start: int, end: int) -> bool:
            """Add constraint if it's not a duplicate or overlapping"""
            if not phrase or not phrase.strip():
                return False
            
            # Normalize for comparison
            normalized = self._normalize_constraint_phrase(phrase)
            if not normalized or normalized in seen_normalized:
                return False
            
            # Check for span overlap with existing constraints
            for existing_start, existing_end in seen_spans:
                # Check if spans overlap
                if not (end <= existing_start or start >= existing_end):
                    # There's an overlap - keep the longer/more specific one
                    if (end - start) <= (existing_end - existing_start):
                        return False  # Current is shorter, skip it
                    else:
                        # Current is longer - remove the shorter one
                        for i, (c, s, e) in enumerate(constraints):
                            if s == existing_start and e == existing_end:
                                constraints.pop(i)
                                seen_spans.remove((existing_start, existing_end))
                                # Remove from seen_normalized
                                c_norm = self._normalize_constraint_phrase(c)
                                seen_normalized.discard(c_norm)
                                break
            
            constraints.append((phrase.strip(), start, end))
            seen_spans.append((start, end))
            seen_normalized.add(normalized)
            return True

        # Pattern 1: "within X time" constraints
        for m in re.finditer(r'\bwithin\s+\d+(?:\.\d+)?\s*(?:second|seconds|minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years|ms|sec|min|hr)s?\b', text, re.IGNORECASE):
            add_constraint(m.group(0), m.start(), m.end())

        # Pattern 2: "every X time" - FREQUENCY constraints
        for m in re.finditer(r'\bevery\s+\d+(?:\.\d+)?\s*(?:second|seconds|minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years|ms|sec|min|hr)s?\b', text, re.IGNORECASE):
            add_constraint(m.group(0), m.start(), m.end())

        # Pattern 3: "for up to X time" constraints
        for m in re.finditer(r'\bfor\s+up\s+to\s+\d+(?:\.\d+)?\s*(?:second|seconds|minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years|ms|sec|min|hr)s?\b', text, re.IGNORECASE):
            add_constraint(m.group(0), m.start(), m.end())

        # Pattern 4: "at [time]" constraints
        for m in re.finditer(r'\bat\s+(midnight|noon|\d{1,2}:\d{2}\s*[ap]m)\b', text, re.IGNORECASE):
            add_constraint(m.group(0), m.start(), m.end())

        # Pattern 5: Exception/conditional constraints
        for m in re.finditer(r'\b(unless|except|except when|except if)\s+[^.;:]+', text, re.IGNORECASE):
            add_constraint(m.group(0), m.start(), m.end())

        # Pattern 6: Resource consumption constraints
        for m in re.finditer(r'\b(not\s+)?consume\s+(more than|less than|over|under)\s+\d+(?:\.\d+)?\s*[A-Za-z]+\b', text, re.IGNORECASE):
            phrase = m.group(0).strip()
            phrase = re.sub(r'\s+of\s+\w+', '', phrase, flags=re.IGNORECASE).strip()
            add_constraint(phrase, m.start(), m.end())

        # Pattern 7: Quantitative constraints (at least, at most, etc.)
        for m in re.finditer(r'\b(at least|at most|less than|greater than|no more than|no less than|not exceeding|up to|more than)\s+\d+(?:\.\d+)?\s*[a-zA-Z%]+\b', text, re.IGNORECASE):
            phrase = m.group(0).strip()
            if any(u in phrase.lower() for u in self.all_units):
                add_constraint(phrase, m.start(), m.end())

        # Pattern 8: Technology/version constraints
        for m in re.finditer(r'\busing\s+[A-Z]+\s+\d+(?:\.\d+)?(?:\s+or\s+(?:higher|above|later|newer))?\b', text, re.IGNORECASE):
            add_constraint(m.group(0), m.start(), m.end())

        # Pattern 9: "after X time" constraints
        for m in re.finditer(r'\bafter\s+\d+(?:\.\d+)?\s*(?:second|seconds|minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years|ms|sec|min|hr)s?\b', text, re.IGNORECASE):
            add_constraint(m.group(0), m.start(), m.end())

        # NLP-BASED STRATEGIES

        # Strategy 1: Detect adverbial modifiers with numbers and time units
        for token in doc:
            if token.dep_ in {"advmod", "npadvmod", "prep"}:
                phrase_tokens = [token] + list(token.subtree)
                phrase_text = " ".join([t.text for t in sorted(phrase_tokens, key=lambda x: x.i)])

                has_number = any(t.pos_ == "NUM" or t.like_num for t in phrase_tokens)
                has_time_unit = any(t.text.lower() in self.time_units for t in phrase_tokens)
                has_quantity_unit = any(t.text.lower() in self.quantity_units for t in phrase_tokens)

                if has_number and (has_time_unit or has_quantity_unit):
                    phrase = phrase_text.strip()
                    if len(phrase.split()) >= 2:
                        # Find span in original text
                        start_idx = min(t.idx for t in phrase_tokens)
                        end_idx = max(t.idx + len(t.text) for t in phrase_tokens)
                        add_constraint(phrase, start_idx, end_idx)

        # Strategy 2: Detect prepositional phrases with constraints
        constraint_preps = {"within", "every", "after", "before", "in", "for", "at", "by", "under", "over"}

        for token in doc:
            if token.dep_ == "prep" and token.text.lower() in constraint_preps:
                pobj_tokens = [child for child in token.children if child.dep_ == "pobj"]

                for pobj in pobj_tokens:
                    phrase_tokens = [token] + [pobj] + list(pobj.subtree)
                    phrase_text = " ".join([t.text for t in sorted(phrase_tokens, key=lambda x: x.i)])

                    has_number = any(t.pos_ == "NUM" or t.like_num for t in phrase_tokens)
                    has_unit = any(t.text.lower() in self.all_units for t in phrase_tokens)

                    if has_number and has_unit:
                        phrase = phrase_text.strip()
                        start_idx = min(t.idx for t in phrase_tokens)
                        end_idx = max(t.idx + len(t.text) for t in phrase_tokens)
                        add_constraint(phrase, start_idx, end_idx)

        # Return sorted unique constraints (by their appearance in text)
        constraints.sort(key=lambda x: x[1])  # Sort by start position
        return ", ".join([c[0] for c in constraints]) if constraints else "Not detected"


    def _normalize_constraint_phrase(self, phrase: str) -> str:
        """
        Normalize constraint phrase for duplicate detection
        """
        if not phrase:
            return ""
        
        # Convert to lowercase
        normalized = phrase.lower().strip()
        
        # Remove extra whitespace
        normalized = re.sub(r'\s+', ' ', normalized)
        
        # Remove leading/trailing articles
        normalized = re.sub(r'^\s*(the|a|an)\s+', '', normalized)
        normalized = re.sub(r'\s+(the|a|an)\s*$', '', normalized)
        
        # Normalize time units (singular form)
        time_unit_map = {
            'seconds': 'second', 'minutes': 'minute', 'hours': 'hour',
            'days': 'day', 'weeks': 'week', 'months': 'month', 'years': 'year'
        }
        for plural, singular in time_unit_map.items():
            normalized = re.sub(r'\b' + plural + r'\b', singular, normalized)
        
        return normalized.strip()

    def _extract_localization(self, text: str, constraint: str) -> str:
        locs = set()
        seen = set()

        constraint_phrases = set()
        if constraint != "Not detected":
            constraint_phrases = {self._norm(p.strip()) for p in constraint.split(",")}

        patterns = [
            r'\b(when|after|before|upon|during|once|following|as soon as|whenever)\s+[^,.;:]+',
        ]

        for pat in patterns:
            for m in re.finditer(pat, text, re.IGNORECASE):
                phrase = m.group(0).strip()
                norm = self._norm(phrase)

                if (self._is_purpose_clause(phrase) or
                    norm in constraint_phrases or
                    self._has_quantitative(phrase)):
                    continue

                if norm not in seen:
                    locs.add(phrase)
                    seen.add(norm)

        for m in re.finditer(r'\bunder\s+(normal|typical|standard|average|specific|certain|heavy|light|peak|low)\s+\w+\s+conditions?\b', text, re.IGNORECASE):
            phrase = m.group(0).strip()
            norm = self._norm(phrase)
            if norm not in seen and norm not in constraint_phrases:
                locs.add(phrase)
                seen.add(norm)

        return ", ".join(sorted(locs)) if locs else "Not detected"

    def _is_purpose_clause(self, s: str) -> bool:
        return any(m in s.lower() for m in self.purpose_markers)

    def _has_quantitative(self, s: str) -> bool:
        s = s.lower()
        return bool(re.search(r'\d+', s)) and any(u in s for u in self.all_units)

    def _extract_action_nlp(self, doc, text: str, constraint: str) -> str:
      """
      ENHANCED: Full NLP-based action extraction
      Goes beyond modal verbs to detect actions based on grammatical role
      EXCLUDES actions that appear in localization or constraint phrases
      """
      actions = set()
      constraint_lower = constraint.lower() if constraint != "Not detected" else ""
      
      # Build forbidden spans from localization and constraint
      forbidden_spans = []
      
      # Add constraint spans
      if constraint != "Not detected":
          for phrase in constraint.split(","):
              phrase = phrase.strip()
              for m in re.finditer(re.escape(phrase), text, re.IGNORECASE):
                  forbidden_spans.append((m.start(), m.end()))
      
      # Add localization spans (we'll extract localization here for this check)
      localization = self._extract_localization(text, constraint)
      if localization != "Not detected":
          for phrase in localization.split(","):
              phrase = phrase.strip()
              for m in re.finditer(re.escape(phrase), text, re.IGNORECASE):
                  forbidden_spans.append((m.start(), m.end()))

      def _is_action_in_forbidden_span(action_token):
          """Check if action token falls within localization/constraint spans"""
          token_start = action_token.idx
          token_end = action_token.idx + len(action_token.text)
          
          for span_start, span_end in forbidden_spans:
              if not (token_end <= span_start or token_start >= span_end):
                  return True
          return False

      # Strategy 1: Modal verb + main verb (traditional)
      modal = next((t for t in doc if t.text.lower() in self.modal_verbs and t.dep_ == "aux"), None)

      if modal and modal.head.pos_ == "VERB":
          root = modal.head
          
          # Skip if this action is in localization/constraint
          if not _is_action_in_forbidden_span(root):
              queue = deque([root])
              visited = {root}

              while queue:
                  v = queue.popleft()
                  verb_lemma = v.lemma_.lower()

                  if verb_lemma in self.auxiliary_verbs:
                      continue

                  # Additional check: skip if verb appears in constraint context
                  verb_in_constraint = False
                  for form in [v.text.lower(), verb_lemma]:
                      if form in constraint_lower:
                          if re.search(rf'\b(while|during|when)\s+\w*{form}\w*\b', constraint_lower):
                              verb_in_constraint = True
                              break

                  if not verb_in_constraint:
                      actions.add(verb_lemma)

                  for child in v.children:
                      if child.dep_ == "conj" and child.pos_ == "VERB" and child not in visited:
                          # Skip coordinated verbs that are in forbidden spans
                          if not _is_action_in_forbidden_span(child):
                              visited.add(child)
                              queue.append(child)

      # Strategy 2: ROOT verb (when no modal present)
      if not actions:
          root = next((t for t in doc if t.dep_ == "ROOT" and t.pos_ == "VERB"), None)
          if root and not _is_action_in_forbidden_span(root):
              verb_lemma = root.lemma_.lower()
              if verb_lemma not in self.non_action_verbs:
                  if not (verb_lemma in constraint_lower and re.search(rf'\b(while|during|when)\s+\w*{verb_lemma}\w*\b', constraint_lower)):
                      actions.add(verb_lemma)

                      # Add coordinated verbs (if not in forbidden spans)
                      for child in root.children:
                          if child.dep_ == "conj" and child.pos_ == "VERB" and not _is_action_in_forbidden_span(child):
                              conj_lemma = child.lemma_.lower()
                              if conj_lemma not in self.non_action_verbs:
                                  actions.add(conj_lemma)

      # Strategy 3: Infinitive verbs (xcomp)
      for token in doc:
          if token.dep_ == "xcomp" and token.pos_ == "VERB" and not _is_action_in_forbidden_span(token):
              verb_lemma = token.lemma_.lower()
              if verb_lemma not in self.non_action_verbs and verb_lemma not in constraint_lower:
                  actions.add(verb_lemma)

      # Strategy 4: Gerund actions ("capable of [doing]")
      capable_pattern = r'\b(?:capable of|responsible for|in charge of)\s+([\w\s,]+(?:and|or)[\w\s,]+)'
      for match in re.finditer(capable_pattern, text.lower()):
          gerund_phrase = match.group(1)
          individual_gerunds = re.findall(r'\b(\w+ing)\b', gerund_phrase)
          for gerund in individual_gerunds:
              if gerund not in {"being", "having", "doing"}:
                  base = gerund[:-3] if len(gerund) > 3 else gerund
                  # Check if this gerund phrase overlaps with forbidden spans
                  gerund_match = re.search(re.escape(gerund), text, re.IGNORECASE)
                  if gerund_match:
                      gerund_start, gerund_end = gerund_match.span()
                      in_forbidden = any(not (gerund_end <= start or gerund_start >= end) 
                                      for start, end in forbidden_spans)
                      if not in_forbidden:
                          actions.add(base)

      # Strategy 5: Passive constructions (nsubjpass)
      for token in doc:
          if token.dep_ == "nsubjpass":
              passive_verb = token.head
              if (passive_verb.pos_ == "VERB" and 
                  not _is_action_in_forbidden_span(passive_verb)):
                  verb_lemma = passive_verb.lemma_.lower()
                  if verb_lemma not in self.non_action_verbs and verb_lemma not in constraint_lower:
                      actions.add(verb_lemma)

      # Strategy 6: Prepositional object verbs (gerunds after prepositions)
      for token in doc:
          if token.dep_ == "prep" and token.text.lower() == "of":
              for pobj in token.children:
                  if pobj.dep_ == "pobj" and not _is_action_in_forbidden_span(pobj):
                      if pobj.tag_ == "VBG" or (pobj.pos_ == "NOUN" and pobj.text.endswith("ing")):
                          gerund_lemma = pobj.lemma_.lower()
                          if gerund_lemma.endswith("ing"):
                              base = gerund_lemma[:-3]
                              if base and base not in self.non_action_verbs:
                                  actions.add(base)

      # Strategy 7: Any verb with direct object (strong action indicator)
      for token in doc:
          if (token.pos_ == "VERB" and 
              token.lemma_.lower() not in self.non_action_verbs and
              not _is_action_in_forbidden_span(token)):
              
              has_dobj = any(child.dep_ == "dobj" for child in token.children)
              if has_dobj:
                  verb_lemma = token.lemma_.lower()
                  if verb_lemma not in constraint_lower:
                      actions.add(verb_lemma)

      return ", ".join(sorted(actions)) if actions else "Not detected"

    def _extract_target_nlp(self, doc, action: str, localization: str, constraint: str, text: str) -> str:
        """
        ENHANCED: Full NLP-based target extraction
        Detects targets based on grammatical relationships, not just direct objects
        """
        targets = set()
        used = set()
        action_lemmas = [a.strip() for a in action.split(",") if a != "Not detected"]

        # Build forbidden spans (localization + constraint)
        forbidden_spans = []
        all_forbidden = []

        if constraint != "Not detected":
            all_forbidden.extend(constraint.split(","))
        if localization != "Not detected":
            all_forbidden.extend(localization.split(","))

        for phrase in all_forbidden:
            phrase = phrase.strip()
            for m in re.finditer(re.escape(phrase), text, re.IGNORECASE):
                forbidden_spans.append((m.start(), m.end()))

        # Strategy 1: Direct objects (dobj) of action verbs
        action_tokens = [t for t in doc if t.lemma_ in action_lemmas and t.pos_ == "VERB"]

        for token in action_tokens:
            for child in token.children:
                if child.dep_ == "dobj" and child.i not in used:
                    if not self._token_in_spans(child, forbidden_spans):
                        phrase = self._get_full_np(child, doc, forbidden_spans)
                        if phrase and self._valid_target(phrase, text):
                            targets.add(phrase)
                            used.add(child.i)

                        # Get coordinated targets
                        for conj_child in child.children:
                            if conj_child.dep_ == "conj" and conj_child.i not in used:
                                if not self._token_in_spans(conj_child, forbidden_spans):
                                    conj_phrase = self._get_full_np(conj_child, doc, forbidden_spans)
                                    if conj_phrase and self._valid_target(conj_phrase, text):
                                        targets.add(conj_phrase)
                                        used.add(conj_child.i)

        # Strategy 2: Prepositional objects (pobj) after action verbs
        for token in action_tokens:
            for child in token.children:
                if child.dep_ == "prep":
                    # Skip "provide X for Y" pattern (Y is beneficiary, not target)
                    if token.lemma_ == "provide" and child.text.lower() == "for":
                        continue

                    for pobj in child.children:
                        if pobj.dep_ in {"pobj", "dobj"} and pobj.i not in used:
                            if not self._token_in_spans(pobj, forbidden_spans):
                                phrase = self._get_full_np_with_prep(child, pobj, doc, forbidden_spans)
                                if phrase and self._valid_target(phrase, text):
                                    targets.add(phrase)
                                    used.add(pobj.i)

        # Strategy 3: Passive subjects (nsubjpass) are often targets
        for token in doc:
            if token.dep_ == "nsubjpass" and token.i not in used:
                if token.head.lemma_ in action_lemmas:
                    if not self._token_in_spans(token, forbidden_spans):
                        phrase = self._get_full_np(token, doc, forbidden_spans)
                        if phrase and self._valid_target(phrase, text):
                            targets.add(phrase)
                            used.add(token.i)

        # Strategy 4: Attribute complements (attr) - "The system is X"
        for token in action_tokens:
            for child in token.children:
                if child.dep_ == "attr" and child.i not in used:
                    if not self._token_in_spans(child, forbidden_spans):
                        phrase = self._get_full_np(child, doc, forbidden_spans)
                        if phrase and self._valid_target(phrase, text):
                            targets.add(phrase)
                            used.add(child.i)

        # Strategy 5: Open clausal complements (xcomp) - infinitive constructions
        for token in action_tokens:
            for child in token.children:
                if child.dep_ == "xcomp" and child.pos_ == "VERB":
                    # Look for objects of the xcomp verb
                    for xcomp_child in child.children:
                        if xcomp_child.dep_ == "dobj" and xcomp_child.i not in used:
                            if not self._token_in_spans(xcomp_child, forbidden_spans):
                                phrase = self._get_full_np(xcomp_child, doc, forbidden_spans)
                                if phrase and self._valid_target(phrase, text):
                                    targets.add(phrase)
                                    used.add(xcomp_child.i)

        # Strategy 6: Gerund objects (targets of gerund actions)
        for token in doc:
            if token.dep_ == "prep" and token.text.lower() == "of":
                for pobj in token.children:
                    if pobj.dep_ == "pobj" and (pobj.tag_ == "VBG" or pobj.text.endswith("ing")):
                        for gerund_child in pobj.children:
                            if gerund_child.dep_ == "dobj" and gerund_child.i not in used:
                                if not self._token_in_spans(gerund_child, forbidden_spans):
                                    phrase = self._get_full_np(gerund_child, doc, forbidden_spans)
                                    if phrase and self._valid_target(phrase, text):
                                        targets.add(phrase)
                                        used.add(gerund_child.i)

        # Strategy 7: Compound nouns after action verbs (technical terms)
        for token in action_tokens:
            for child in token.children:
                if child.dep_ == "compound" and child.i not in used:
                    if not self._token_in_spans(child, forbidden_spans):
                        # Check if this is part of a larger NP
                        head = child.head
                        if head.pos_ in {"NOUN", "PROPN"}:
                            phrase = self._get_full_np(head, doc, forbidden_spans)
                            if phrase and self._valid_target(phrase, text):
                                targets.add(phrase)
                                used.add(head.i)

        # Strategy 8: Named entities (often targets in requirements)
        for ent in doc.ents:
            if ent.label_ in {"PRODUCT", "ORG", "FACILITY", "GPE"}:
                if not any(self._token_in_spans(t, forbidden_spans) for t in ent):
                    phrase = ent.text
                    if self._valid_target(phrase, text) and phrase not in used:
                        targets.add(phrase)

        # Strategy 9: Platform-specific patterns
        if "operate" in action_lemmas:
            platform_pattern = r'\bon\s+((?:' + '|'.join(self.platforms) + r')(?:\s+(?:and|as well as|,)\s+(?:' + '|'.join(self.platforms) + r'))*)'
            platform_match = re.search(platform_pattern, text, re.IGNORECASE)
            if platform_match:
                platform_text = platform_match.group(1)
                platforms_found = re.split(r'\s+(?:and|as well as|,)\s+', platform_text)
                for plat in platforms_found:
                    plat = plat.strip()
                    if plat and plat.lower() != "platform":
                        targets.add(plat)

        # Strategy 10: "provide X for Y" pattern (X is target)
        if "provide" in action_lemmas and not targets:
            provide_match = re.search(r'\bprovide\s+([^,]+?)\s+for\s+', text, re.IGNORECASE)
            if provide_match:
                target_phrase = provide_match.group(1).strip()
                target_phrase = re.sub(r'\s+to\s+\w+.*', '', target_phrase, flags=re.IGNORECASE).strip()
                if self._valid_target(target_phrase, text):
                    targets.add(target_phrase)

        # Strategy 11: Resource consumption targets
        if "consume" in action_lemmas:
            ram_match = re.search(r'\bof\s+(RAM|memory|CPU|disk|storage)\b', text, re.IGNORECASE)
            if ram_match:
                resource = ram_match.group(1)
                targets.add(resource.upper() if resource.lower() in {"ram", "cpu"} else resource.capitalize())

        # Strategy 12: Any noun phrase after action verb (fallback)
        if not targets:
            for token in action_tokens:
                # Look ahead for noun phrases
                for i in range(token.i + 1, min(token.i + 5, len(doc))):
                    candidate = doc[i]
                    if candidate.pos_ in {"NOUN", "PROPN"} and candidate.i not in used:
                        if not self._token_in_spans(candidate, forbidden_spans):
                            phrase = self._get_full_np(candidate, doc, forbidden_spans)
                            if phrase and self._valid_target(phrase, text):
                                targets.add(phrase)
                                used.add(candidate.i)
                                break

        return ", ".join(sorted(targets)) if targets else "Not detected"

    def _token_in_spans(self, token, spans: List[Tuple[int, int]]) -> bool:
        token_start = token.idx
        token_end = token.idx + len(token.text)

        for span_start, span_end in spans:
            if not (token_end <= span_start or token_start >= span_end):
                return True
        return False

    def _get_full_np(self, token, doc, forbidden_spans: List[Tuple[int, int]]):
        parts = []
        relevant_tokens = []
        for left in token.lefts:
            if left.dep_ in {"det", "amod", "compound", "nummod", "poss", "quantmod"}:
                relevant_tokens.append(left)
        relevant_tokens.append(token)
        for right in token.rights:
            if right.dep_ in {"compound", "amod"}:
                relevant_tokens.append(right)

        for t in sorted(relevant_tokens, key=lambda x: x.i):
            if not self._token_in_spans(t, forbidden_spans):
                parts.append(t.text)

        return " ".join(parts) if parts else None

    def _get_full_np_with_prep(self, prep_token, pobj_token, doc, forbidden_spans: List[Tuple[int, int]]):
        if self._token_in_spans(prep_token, forbidden_spans):
            return None

        parts = [prep_token.text]
        relevant_tokens = []
        for left in pobj_token.lefts:
            if left.dep_ in {"det", "amod", "compound", "nummod", "poss", "quantmod"}:
                relevant_tokens.append(left)
        relevant_tokens.append(pobj_token)
        for right in pobj_token.rights:
            if right.dep_ in {"compound", "amod", "cc", "conj"}:
                relevant_tokens.append(right)
                if right.dep_ == "conj":
                    for sub_right in right.rights:
                        if sub_right.dep_ in {"compound", "amod"}:
                            relevant_tokens.append(sub_right)

        for t in sorted(relevant_tokens, key=lambda x: x.i):
            if not self._token_in_spans(t, forbidden_spans):
                parts.append(t.text)

        return " ".join(parts) if len(parts) > 1 else None

    def _valid_target(self, t: str, full_text: str) -> bool:
        if not t:
            return False

        t_clean = re.sub(r'^(the|a|an)\s+', '', t.lower().strip())

        if self._is_purpose_clause(t_clean):
            return False

        if any(platform in t_clean for platform in self.platforms):
            return True

        resource_terms = {"ram", "memory", "cpu", "disk", "storage"}
        if any(term in t_clean for term in resource_terms):
            return True

        if "communication" in t_clean or "between" in t_clean:
            return True

        if re.match(r'^\d+(\.\d+)?\s*[a-z%]+', t_clean):
            return False

        if t_clean in self.all_units:
            return False

        return len(t_clean) >= 2

    def _extract_actor(self, doc, localization: str, target: str) -> str:
        """
        ENHANCED: NLP-based actor detection
        No dictionary dependency - identifies actors by grammatical role
        """
        loc_spans = self._build_spans(localization, doc.text)
        target_phrases = {t.strip().lower() for t in target.split(",")} if target != "Not detected" else set()

        # Strategy 1: Find nominal subject (nsubj) of modal verb construction
        for token in doc:
            if token.dep_ == "nsubj" and token.head.pos_ == "VERB":
                if not self._token_overlaps_spans(token, loc_spans):
                    actor = self._get_simple_np(token)
                    actor_lower = actor.lower().strip()

                    if actor_lower not in self.non_actor_words:
                        if not self._match_target(actor, target_phrases):
                            return self._fmt_actor(actor)

        # Strategy 2: Find passive agent (by X)
        for token in doc:
            if token.dep_ == "agent":
                for child in token.children:
                    if child.dep_ == "pobj":
                        actor = self._get_simple_np(child)
                        actor_lower = actor.lower().strip()

                        if actor_lower not in self.non_actor_words:
                            if not self._match_target(actor, target_phrases):
                                return self._fmt_actor(actor)

        # Strategy 3: Look for any NOUN/PROPN before modal verb
        modal_token = next((t for t in doc if t.text.lower() in self.modal_verbs and t.dep_ == "aux"), None)

        if modal_token:
            for token in doc:
                if token.i < modal_token.i and token.pos_ in {"NOUN", "PROPN"}:
                    if token.dep_ in {"nsubj", "nsubjpass", "ROOT"}:
                        if not self._token_overlaps_spans(token, loc_spans):
                            actor = self._get_simple_np(token)
                            actor_lower = actor.lower().strip()

                            if actor_lower not in self.non_actor_words:
                                if not self._match_target(actor, target_phrases):
                                    return self._fmt_actor(actor)

        # Strategy 4: First noun phrase before any verb
        first_verb_idx = next((t.i for t in doc if t.pos_ == "VERB"), len(doc))

        for token in doc:
            if token.i < first_verb_idx and token.pos_ in {"NOUN", "PROPN"}:
                if not self._token_overlaps_spans(token, loc_spans):
                    actor = self._get_simple_np(token)
                    actor_lower = actor.lower().strip()

                    if len(actor_lower) > 2 and actor_lower not in self.non_actor_words:
                        if not self._match_target(actor, target_phrases):
                            return self._fmt_actor(actor)

        return "System"

    def _build_spans(self, text: str, full: str) -> List[Tuple[int, int]]:
        spans = []
        if text == "Not detected":
            return spans
        for p in text.split(","):
            p = p.strip()
            for m in re.finditer(re.escape(p), full, re.IGNORECASE):
                spans.append((m.start(), m.end()))
        return spans

    def _token_overlaps_spans(self, token, spans):
        s, e = token.idx, token.idx + len(token.text)
        return any(not (e <= start or s >= end) for start, end in spans)

    def _get_simple_np(self, token):
        parts = []
        for left in token.lefts:
            if left.dep_ in {"det", "amod", "compound", "nummod", "poss", "quantmod"}:
                parts.append(left.text)
        parts.append(token.text)
        for right in token.rights:
            if right.dep_ in {"compound", "amod"}:
                parts.append(right.text)
        return " ".join(parts)

    def _match_target(self, a: str, targets: Set[str]) -> bool:
        a = re.sub(r'^(the|a|an)\s+', '', a.lower().strip())
        return any(a == t or a in t or t in a for t in targets)

    def _fmt_actor(self, a: str) -> str:
        return re.sub(r'^(the|a|an)\s+', '', a.strip(), flags=re.IGNORECASE).capitalize()

    def _norm(self, s: str) -> str:
        return " ".join(s.lower().strip().split())

    def _calculate_confidence(self, c: RequirementComponent) -> float:
        score = count = 0
        if c.action != "Not detected": score += 1.0; count += 1
        if c.actor not in {"Not detected", "System"}: score += 0.9; count += 1
        if c.target != "Not detected": score += 0.9; count += 1
        if c.localization != "Not detected": score += 0.7; count += 1
        if c.constraint != "Not detected": score += 0.7; count += 1
        return round(score / count, 2) if count > 0 else 0.0

    def process_multiple_requirements(self, reqs: List[Dict[str, str]]) -> List[RequirementComponent]:
        return [self.extract_components(r['text'], r.get('id', '')) for r in reqs]


def format_output(c: RequirementComponent):
    """Format output with atomicity validation"""
    print("\n" + "="*90)
    print(f"REQUIREMENT: {c.requirement_id or 'UNLABELED'}")
    print("="*90)
    print(f"\nOriginal: {c.original_requirement}\n")
    print("-"*90)
    print("ATOMICITY VALIDATION")
    print("-"*90)
    atomicity_status = "✓ ATOMIC" if c.is_atomic else "✗ NON-ATOMIC"
    print(f"Status           : {atomicity_status}")
    print(f"Atomicity Score  : {c.atomicity_score:.2f}")
    print(f"Violations       : {c.atomicity_violations}")
    print("-"*90)
    print("EXTRACTED COMPONENTS")
    print("-"*90)
    print(f"Localization     : {c.localization}")
    print(f"  → Lemmatized   : {c.localization_lemmatized}")
    print(f"  → Cleaned      : {c.localization_cleaned}")
    print(f"\nActor/Owner      : {c.actor}")
    print(f"  → Lemmatized   : {c.actor_lemmatized}")
    print(f"  → Cleaned      : {c.actor_cleaned}")
    print(f"\nAction           : {c.action}")
    print(f"  → Lemmatized   : {c.action_lemmatized}")
    print(f"  → Cleaned      : {c.action_cleaned}")
    print(f"\nTarget           : {c.target}")
    print(f"  → Lemmatized   : {c.target_lemmatized}")
    print(f"  → Cleaned      : {c.target_cleaned}")
    print(f"\nConstraint       : {c.constraint}")
    print(f"  → Lemmatized   : {c.constraint_lemmatized}")
    print(f"  → Cleaned      : {c.constraint_cleaned}")
    print(f"\nConfidence: {c.confidence:.2f} | Method: {c.extraction_method}")
    print("="*90 + "\n")


if __name__ == "__main__":
    print("\n" + "="*90)
    print("REQIFY v13.4 – Full NLP-Based Component Extraction")
    print("="*90 + "\n")

    extractor = AdvancedHybridExtractor()

    requirements = [
        {"id": "1", "text": "The system shall send a verification email within 2 seconds after successful user registration."},
        {"id": "2", "text": "The application shall disable the “Submit” button when required fields are empty."},
        {"id": "3", "text": "The system shall operate correctly on Windows, Linux, and macOS platforms."},
        {"id": "4", "text": "The mobile app shall switch to dark mode after the device enters low-power mode."},
        {"id": "5", "text": "The application shall send a confirmation email and log the transaction."},
        {"id": "6", "text": "The system shall encrypt all communication using TLS 1.3."},
        {"id": "7", "text": "The interface shall load within 2 seconds under normal network conditions."},
        {"id": "8", "text": "The API shall respond within 200ms."},
        {"id": "9", "text": "The application shall display a warning before deleting any record."},
        {"id": "10", "text": "The mobile app shall operate offline for up to 24 hours."},
        {"id": "11", "text": "The dashboard shall refresh data every 5 minutes."},
        {"id": "12", "text": "The payment gateway shall process transactions securely."},
        {"id": "13", "text": "The backup service shall run every 24 hours."},
        {"id": "14", "text": "The cache shall expire after 30 minutes."},
        {"id": "15", "text": "Users must authenticate while accessing sensitive data."},
        {"id": "16", "text": "The notification service sends alerts to administrators."},
    ]

    print(f"Processing {len(requirements)} requirements...\n")
    results = extractor.process_multiple_requirements(requirements)

    for r in results:
        format_output(r)

    atomic_count = sum(1 for r in results if r.is_atomic)
    non_atomic_count = len(results) - atomic_count

    print("\n" + "="*90)
    print("ATOMICITY SUMMARY")
    print("="*90)
    print(f"Total Requirements   : {len(results)}")
    print(f"Atomic (✓)           : {atomic_count} ({atomic_count/len(results)*100:.1f}%)")
    print(f"Non-Atomic (✗)       : {non_atomic_count} ({non_atomic_count/len(results)*100:.1f}%)")
    print("="*90 + "\n")

    df = pd.DataFrame([asdict(r) for r in results])
    df.to_csv("reqify_v13.4_full_nlp_extraction.csv", index=False)
    print("Results saved to 'reqify_v13.4_full_nlp_extraction.csv'\n")

    print("="*90)
    print("REQIFY v13.4 KEY ENHANCEMENTS:")
    print("="*90)
    print("✓ ACTION EXTRACTION:")
    print("  • 7 NLP-based strategies (beyond modal verbs)")
    print("  • Detects ROOT verbs, infinitives, gerunds, passive constructions")
    print("  • Identifies verbs with direct objects as strong action indicators")
    print("")
    print("✓ TARGET EXTRACTION:")
    print("  • 12 NLP-based strategies (beyond direct objects)")
    print("  • Detects prepositional objects, passive subjects, attributes")
    print("  • Identifies named entities, compound nouns, gerund objects")
    print("  • Fallback: any noun phrase after action verb")
    print("")
    print("✓ ACTOR EXTRACTION:")
    print("  • 4 NLP-based strategies (no dictionary dependency)")
    print("  • Identifies subjects by grammatical role (nsubj, nsubjpass)")
    print("  • Detects passive agents and pre-modal nouns")
    print("")
    print("✓ CONSTRAINT EXTRACTION:")
    print("  • 2 NLP-based strategies + 7 regex patterns")
    print("  • Detects adverbial modifiers, prepositional phrases")
    print("  • Frequency constraints: 'every X time'")
    print("")
    print("✓ All previous atomicity validation rules preserved")
    print("="*90)