<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { supabase } from '$lib/supabaseClient';
  import { Button, Badge, Alert } from '$lib/components/ui';
  import { user } from '$lib/stores/auth';

  export let skillId: string;
  export let onComplete: (result: any) => void = () => {};

  let assessment: any = null;
  let loading = true;
  let error: string | null = null;
  let currentQuestion = 0;
  let answers: Record<string, string> = {};
  let timeLeft: number = 0;
  let timer: NodeJS.Timeout;

  async function loadAssessment() {
    try {
      loading = true;
      error = null;

      const { data, error: fetchError } = await supabase
        .from('skill_assessments')
        .select(`
          *,
          skill:skill_id (*),
          questions:assessment_questions (
            id,
            question,
            options,
            type,
            points
          )
        `)
        .eq('skill_id', skillId)
        .single();

      if (fetchError) throw fetchError;
      assessment = data;
      timeLeft = assessment.time_limit * 60; // Convert minutes to seconds
      startTimer();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function startTimer() {
    timer = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        submitAssessment();
      }
    }, 1000);
  }

  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  async function submitAssessment() {
    if (!$user) return;
    clearInterval(timer);

    try {
      loading = true;
      error = null;

      // Calculate score
      let totalPoints = 0;
      let earnedPoints = 0;
      assessment.questions.forEach((question: any) => {
        totalPoints += question.points;
        if (answers[question.id] === question.correct_answer) {
          earnedPoints += question.points;
        }
      });

      const score = (earnedPoints / totalPoints) * 100;
      const passed = score >= assessment.passing_score;

      // Save result
      const { data: result, error: submitError } = await supabase
        .from('assessment_results')
        .insert({
          user_id: $user.id,
          assessment_id: assessment.id,
          score,
          passed,
          answers,
          time_taken: assessment.time_limit * 60 - timeLeft
        })
        .select()
        .single();

      if (submitError) throw submitError;

      // Award badge if passed
      if (passed) {
        const { error: badgeError } = await supabase
          .from('user_badges')
          .insert({
            user_id: $user.id,
            badge_id: assessment.skill.badge_id,
            earned_through: 'assessment',
            assessment_result_id: result.id
          });

        if (badgeError) throw badgeError;
      }

      onComplete(result);
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function handleAnswer(questionId: string, answer: string) {
    answers[questionId] = answer;
  }

  onMount(() => {
    loadAssessment();
    return () => clearInterval(timer);
  });
</script>

<div class="max-w-3xl mx-auto">
  {#if loading}
    <div class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>
  {:else if error}
    <Alert variant="error" title="Error" message={error} />
  {:else if assessment}
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      <!-- Header -->
      <div class="p-6 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
              {assessment.skill.name} Assessment
            </h1>
            <p class="mt-1 text-gray-600 dark:text-gray-400">
              {assessment.description}
            </p>
          </div>
          <div class="text-right">
            <div class="text-2xl font-mono text-gray-900 dark:text-white">
              {formatTime(timeLeft)}
            </div>
            <div class="text-sm text-gray-500 dark:text-gray-400">
              Time Remaining
            </div>
          </div>
        </div>

        <div class="mt-4 flex items-center space-x-4">
          <Badge variant="secondary">
            {assessment.questions.length} Questions
          </Badge>
          <Badge variant="secondary">
            {assessment.time_limit} Minutes
          </Badge>
          <Badge variant="secondary">
            {assessment.passing_score}% to Pass
          </Badge>
        </div>
      </div>

      <!-- Question -->
      <div class="p-6">
        <div class="mb-4">
          <div class="text-sm text-gray-500 dark:text-gray-400">
            Question {currentQuestion + 1} of {assessment.questions.length}
          </div>
          <div class="mt-4 text-lg text-gray-900 dark:text-white">
            {assessment.questions[currentQuestion].question}
          </div>
        </div>

        <!-- Options -->
        <div class="space-y-3">
          {#each assessment.questions[currentQuestion].options as option}
            <label class="flex items-center p-4 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700">
              <input
                type="radio"
                name="answer"
                value={option}
                checked={answers[assessment.questions[currentQuestion].id] === option}
                on:change={() => handleAnswer(assessment.questions[currentQuestion].id, option)}
                class="mr-3"
              />
              <span class="text-gray-700 dark:text-gray-300">{option}</span>
            </label>
          {/each}
        </div>

        <!-- Navigation -->
        <div class="mt-6 flex justify-between">
          <Button
            variant="outline"
            disabled={currentQuestion === 0}
            on:click={() => currentQuestion--}
          >
            Previous
          </Button>

          {#if currentQuestion === assessment.questions.length - 1}
            <Button
              variant="primary"
              on:click={submitAssessment}
              disabled={!answers[assessment.questions[currentQuestion].id]}
            >
              Submit Assessment
            </Button>
          {:else}
            <Button
              variant="primary"
              disabled={!answers[assessment.questions[currentQuestion].id]}
              on:click={() => currentQuestion++}
            >
              Next
            </Button>
          {/if}
        </div>
      </div>
    </div>
  {:else}
    <div class="text-center py-12">
      <p class="text-gray-500 dark:text-gray-400">Assessment not found</p>
    </div>
  {/if}
</div>

<style>
  /* Add any component-specific styles here */
</style> 