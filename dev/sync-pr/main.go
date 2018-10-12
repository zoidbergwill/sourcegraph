package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path"
	"strings"
)

func Usage() {
	fmt.Println("TODO: Usage")
}

var trace = flag.Boolean("trace", "", "Log all commands run")

func main() {
	baseRepo := flag.String("base", "", "Base repository")
	baseBranch := flag.String("baseBranch", "", "Base branch")
	headRepo := flag.String("head", "", "Head repository")
	headBranch := flag.String("headBranch", "", "Head branch")
	ghAccessToken := flag.String("ghtoken", "", "GitHub access token")
	flag.Parse()

	if *baseRepo == "" || *baseBranch == "" || *headRepo == "" || *headBranch == "" {
		log.Printf("# baseRepo was %q", *baseRepo)

		Usage()
		os.Exit(1)
	}

	if err := syncPR(*baseRepo, *baseBranch, *headRepo, *headBranch); err != nil {
		fmt.Printf("Error: %s\n", err)
		os.Exit(1)
	}
}

func syncPR(baseRepo, baseBranch, headRepo, headBranch string) error {
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

	// TODO: make GH PR

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
