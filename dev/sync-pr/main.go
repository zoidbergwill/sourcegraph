package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path"
	"strings"

	"github.com/google/go-github/github"
	"golang.org/x/oauth2"
)

func Usage() {
	fmt.Println("TODO: Usage")
}

var trace = flag.Bool("trace", false, "Log all commands run")

func main() {
	baseRepo := flag.String("baseRepo", "", "Base repository")
	baseBranch := flag.String("baseBranch", "", "Base branch")
	headRepo := flag.String("headRepo", "", "Head repository")
	headBranch := flag.String("headBranch", "", "Head branch")
	ghAccessToken := flag.String("ghtoken", "", "GitHub access token")
	flag.Parse()

	if *baseRepo == "" || *baseBranch == "" || *headRepo == "" || *headBranch == "" {
		log.Printf("# baseRepo was %q", *baseRepo)

		Usage()
		os.Exit(1)
	}

	if err := syncPR(*baseRepo, *baseBranch, *headRepo, *headBranch, *ghAccessToken); err != nil {
		fmt.Printf("Error: %s\n", err)
		os.Exit(1)
	}
}

func syncPR(baseRepo, baseBranch, headRepo, headBranch, ghToken string) error {
	baseRepoURL := fmt.Sprintf("git@github.com:%s.git", baseRepo)
	headRepoURL := fmt.Sprintf("git@github.com:%s.git", headRepo)
	headName := path.Base(headRepo)
	if err := os.Mkdir("workspace", 0777); err != nil {
		return err
	}
	if err := run("git", "clone", baseRepoURL, "workspace"); err != nil {
		return err
	}
	if err := os.Chdir("workspace"); err != nil {
		return err
	}
	if err := run("git", "remote", "add", headName, headRepoURL); err != nil {
		return err
	}
	if err := run("git", "fetch", headName); err != nil {
		return err
	}
	out, err := out("git", "rev-parse", fmt.Sprintf("%s/master", headName))
	if err != nil {
		return err
	}
	headCommit := strings.TrimSpace(out)[0:8]
	headTrackingBranch := fmt.Sprintf("%s-master-%s", headName, headCommit)
	if err := run("git", "checkout", fmt.Sprintf("%s/master", headName), "-b", headTrackingBranch); err != nil {
		return err
	}
	if err := run("git", "push", "origin", headTrackingBranch); err != nil {
		return err
	}

	// make GH PR
	ctx := context.Background()
	ts := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: ghToken},
	)
	tc := oauth2.NewClient(ctx, ts)
	gh := github.NewClient(tc)

	_, _, err = gh.PullRequests.Create(ctx, strings.Split(baseRepo, "/")[0], strings.Split(baseRepo, "/")[1], &github.NewPullRequest{
		Title: github.String(fmt.Sprintf("Sync from %s@%s", baseRepo, baseBranch)),
		Head:  github.String(headTrackingBranch),
		Base:  github.String(baseBranch),
		Body:  github.String("TODO"),
	})
	if err != nil {
		return err
	}

	return nil
}

func run(name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func out(name string, args ...string) (string, error) {
	cmd := exec.Command(name, args...)
	cmd.Stderr = os.Stderr
	out, err := cmd.Output()
	return string(out), err
}
