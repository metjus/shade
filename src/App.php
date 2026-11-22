<?php

declare(strict_types=1);

namespace Shade;

/** Front controller: smerovanie požiadaviek, prihlásenie, CSRF a vykreslenie šablón. */
final class App
{
    private I18n $i18n;

    public function run(): void
    {
        date_default_timezone_set((string) (Config::get()['timezone'] ?? 'Europe/Bratislava'));
        Auth::start();
        $this->i18n = I18n::fromRequest();
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $path = rtrim(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/', '/') ?: '/';

        if ($method === 'POST' && !Auth::verifyCsrf()) {
            http_response_code(400);
            exit('Bad CSRF token');
        }

        if ($path === '/login') {
            $this->login($method);
            return;
        }
        if (!Auth::check()) {
            $this->redirect('/login');
        }

        try {
            $this->route($method, $path);
        } catch (GenerationException $e) {
            $this->flash('error', $this->i18n->t('error.' . $e->getMessage()));
            $this->redirect($_SERVER['HTTP_REFERER'] ?? '/');
        } catch (\Anthropic\Core\Exceptions\AnthropicException $e) {
            error_log('[shade] ' . $e::class . ': ' . $e->getMessage());
            $this->flash('error', $this->i18n->t('error.upstream'));
            $this->redirect($_SERVER['HTTP_REFERER'] ?? '/');
        }
    }

    private function route(string $method, string $path): void
    {
        $id = null;
        if (preg_match('#^/(projects|tasks|posts|ideas)/(\d+)(/[a-z]+)?$#', $path, $m)) {
            $id = (int) $m[2];
            $path = "/{$m[1]}/:id" . ($m[3] ?? '');
        }

        match ("$method $path") {
            'GET /' => $this->today(),
            'GET /calendar' => $this->calendar(),
            'POST /logout' => $this->logout(),
            'GET /projects/new' => $this->projectForm(null),
            'POST /projects' => $this->projectSave(null),
            'GET /projects/:id' => $this->project($id),
            'GET /projects/:id/edit' => $this->projectForm($id),
            'POST /projects/:id' => $this->projectSave($id),
            'POST /projects/:id/delete' => $this->projectDelete($id),
            'POST /projects/:id/plan' => $this->planGenerate($id),
            'POST /projects/:id/repurpose' => $this->repurpose($id),
            'POST /projects/:id/ideas' => $this->ideaAdd($id),
            'POST /ideas/:id' => $this->ideaAction($id),
            'POST /tasks/:id/toggle' => $this->taskToggle($id),
            'POST /posts/:id' => $this->postAction($id),
            default => $this->notFound(),
        };
    }

    // --- obrazovky -------------------------------------------------------

    private function login(string $method): void
    {
        $error = null;
        if ($method === 'POST') {
            if (Auth::login((string) ($_POST['password'] ?? ''))) {
                $this->redirect('/');
            }
            $error = $this->i18n->t('login.wrong');
        }
        $this->render('login', ['error' => $error, 'configured' => Auth::isConfigured()], bare: true);
    }

    private function logout(): never
    {
        Auth::logout();
        $this->redirect('/login');
    }

    private function today(): void
    {
        $today = date('Y-m-d');
        $this->render('today', [
            'due' => Tasks::dueUntil($today),
            'upcoming' => Tasks::upcoming($today, date('Y-m-d', strtotime('+7 days'))),
            'scheduled' => Posts::scheduledBetween($today, $today),
            'reshare' => Posts::reshareCandidates(3),
            'drafts' => Posts::drafts(5),
            'projects' => Projects::all(),
            'today' => $today,
        ]);
    }

    private function calendar(): void
    {
        $month = preg_match('/^\d{4}-\d{2}$/', (string) ($_GET['m'] ?? '')) ? $_GET['m'] : date('Y-m');
        $first = new \DateTimeImmutable("$month-01");
        $last = $first->modify('last day of this month');
        $byDay = [];
        foreach (Posts::scheduledBetween($first->format('Y-m-d'), $last->format('Y-m-d')) as $post) {
            $day = $post['scheduled_for'] ?? substr((string) $post['published_at'], 0, 10);
            $byDay[$day][] = $post;
        }
        $this->render('calendar', [
            'first' => $first,
            'last' => $last,
            'byDay' => $byDay,
            'prev' => $first->modify('-1 month')->format('Y-m'),
            'next' => $first->modify('+1 month')->format('Y-m'),
            'today' => date('Y-m-d'),
        ]);
    }

    private function project(int $id): void
    {
        $project = $this->findProject($id);
        $plan = Plans::latest($id);
        $this->render('project', [
            'project' => $project,
            'plan' => $plan,
            'tasks' => $plan ? Tasks::forPlan((int) $plan['id']) : [],
            'drafts' => Posts::forProject($id, 'draft'),
            'published' => Posts::forProject($id, 'published'),
            'ideas' => Ideas::forProject($id),
            'prefill' => $this->takePrefill($id),
            'today' => date('Y-m-d'),
        ]);
    }

    private function projectForm(?int $id, array $values = [], array $errors = []): void
    {
        $project = $id ? $this->findProject($id) : null;
        $this->render('project_form', [
            'project' => $project,
            'values' => $values ?: ($project ?? ['languages' => $this->i18n->locale, 'type' => 'website', 'goal' => 'users', 'budget' => 'zero']),
            'errors' => $errors,
        ]);
    }

    // --- akcie -----------------------------------------------------------

    private function projectSave(?int $id): void
    {
        if ($id) {
            $this->findProject($id);
        }
        [$data, $errors] = Projects::validate($_POST);
        if ($errors) {
            $this->projectForm($id, $data, $errors);
            return;
        }
        $id = Projects::save($id, $data);
        $this->flash('ok', $this->i18n->t('flash.saved'));
        $this->redirect("/projects/$id");
    }

    private function projectDelete(int $id): never
    {
        Projects::delete($id);
        $this->flash('ok', $this->i18n->t('flash.deleted'));
        $this->redirect('/');
    }

    private function planGenerate(int $id): never
    {
        $project = $this->findProject($id);
        $lang = in_array($_POST['lang'] ?? '', Projects::LANGS, true) ? $_POST['lang'] : explode(',', $project['languages'])[0];
        $note = mb_substr(trim((string) ($_POST['note'] ?? '')), 0, 500);
        Plans::generate($project, $lang, $note !== '' ? $note : null);
        $this->flash('ok', $this->i18n->t(Ai::get()->enabled() ? 'flash.plan' : 'flash.plan_demo'));
        $this->redirect("/projects/$id#plan");
    }

    private function repurpose(int $id): never
    {
        $project = $this->findProject($id);
        $source = mb_substr(trim((string) ($_POST['source'] ?? '')), 0, 6000);
        $channels = array_values(array_intersect(PlanSchema::CHANNELS, (array) ($_POST['channels'] ?? [])));
        $langs = array_values(array_intersect(Projects::LANGS, (array) ($_POST['langs'] ?? [])));
        if (mb_strlen($source) < 20 || !$channels || !$langs) {
            $this->flash('error', $this->i18n->t('error.repurpose'));
            $this->redirect("/projects/$id#repurpose");
        }
        $n = Posts::repurpose($project, $source, $channels, $langs);
        $this->flash('ok', sprintf($this->i18n->t('flash.repurposed'), $n));
        $this->redirect("/projects/$id#drafts");
    }

    private function ideaAdd(int $id): never
    {
        $this->findProject($id);
        Ideas::add($id, (string) ($_POST['text'] ?? ''));
        $this->redirect("/projects/$id#ideas");
    }

    private function ideaAction(int $id): never
    {
        $idea = Ideas::find($id) ?? $this->notFound();
        $pid = (int) $idea['project_id'];
        if (($_POST['action'] ?? '') === 'use') {
            Ideas::markUsed($id);
            $_SESSION['prefill'] = ['project' => $pid, 'source' => $idea['text']];
            $this->redirect("/projects/$pid#repurpose");
        }
        Ideas::delete($id);
        $this->redirect("/projects/$pid#ideas");
    }

    private function takePrefill(int $projectId): string
    {
        $prefill = $_SESSION['prefill'] ?? null;
        unset($_SESSION['prefill']);
        return ($prefill['project'] ?? null) === $projectId ? (string) $prefill['source'] : '';
    }

    private function taskToggle(int $id): never
    {
        Tasks::toggle($id);
        $this->redirect($this->back('/'));
    }

    private function postAction(int $id): never
    {
        $post = Posts::find($id) ?? $this->notFound();
        match ($_POST['action'] ?? '') {
            'save' => [Posts::update($id, (string) ($_POST['text'] ?? '')), Posts::schedule($id, ($_POST['date'] ?? '') ?: null)],
            'publish' => Posts::setStatus($id, 'published'),
            'unpublish' => Posts::setStatus($id, 'draft'),
            'delete' => Posts::delete($id),
            'schedule' => Posts::schedule($id, ($_POST['date'] ?? '') ?: null),
            'evergreen' => Posts::toggleEvergreen($id),
            'results' => Posts::saveResults($id, $_POST),
            'variants' => $this->flash('ok', sprintf($this->i18n->t('flash.variants'), Posts::variants($this->findProject((int) $post['project_id']), $post))),
            default => null,
        };
        $this->redirect($this->back("/projects/{$post['project_id']}#drafts"));
    }

    // --- pomocníci -------------------------------------------------------

    /** @return array<string,mixed> */
    private function findProject(int $id): array
    {
        return Projects::find($id) ?? $this->notFound();
    }

    private function back(string $fallback): string
    {
        $back = (string) ($_POST['back'] ?? '');
        // Len lokálne cesty, nikdy cudzia doména.
        return preg_match('#^/(?!/)#', $back) ? $back : $fallback;
    }

    private function notFound(): never
    {
        http_response_code(404);
        $this->render('not_found', []);
        exit;
    }

    private function flash(string $type, string $message): void
    {
        $_SESSION['flash'] = ['type' => $type, 'message' => $message];
    }

    private function redirect(string $to): never
    {
        header('Location: ' . $to, true, 303);
        exit;
    }

    /** @param array<string,mixed> $vars */
    private function render(string $template, array $vars, bool $bare = false): void
    {
        $i18n = $this->i18n;
        $t = static fn (string $k): string => htmlspecialchars($i18n->t($k), ENT_QUOTES);
        $h = static fn (?string $s): string => htmlspecialchars((string) $s, ENT_QUOTES);
        $csrf = '<input type="hidden" name="_csrf" value="' . Auth::csrfToken() . '">';
        $flash = $_SESSION['flash'] ?? null;
        unset($_SESSION['flash']);
        $demo = !Ai::get()->enabled();
        extract($vars);

        ob_start();
        require __DIR__ . "/../templates/{$template}.php";
        $content = ob_get_clean();
        require __DIR__ . '/../templates/' . ($bare ? 'bare.php' : 'layout.php');
    }
}
