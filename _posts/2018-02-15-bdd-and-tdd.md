---
layout: post
title: 'The Thoughts Behind BDD'
date: '2018-02-15T21:12:00.000-06:00'
author: David Bliss
comments: true
tags:
- software
- testing
- philosophy
---

There was a discussion at work about Test-Driven Development ("TDD") and how to
do it right. I thought the discussion could benefit from some context from the
folks who practice Behavior Driven Development ("BDD"), so here's this post to
talk about it.

# The quick intro

First, let me be clear about something: BDD is not about a specific technical
process, based off of [Dan North's article][dnbdd] (which is the earliest post
I've found). Instead, most of BDD is the results of a terminology change. There
are those who focus on the effects of the philosophy change, rather than the
philosophy itself, based on [Wikipedia's article][wpbdd], but let's start with
a solid foundation.

Most of this is going to be heavily influenced by Dan North's work I linked to
above, so [you may as well read it][dnbdd].

According to Dan North, he created BDD as a reaction to questions about what to
test and how to structure tests. By replacing the word "test" with "behavior,"
Dan was able to reduce the questions he received quite a bit. Something as
simple as being forced to name your method as a sentence summarizing the
scenario can be very helpful in making sure you actually cover what the user is
likely to do. Once you've covered everything the user is likely to do, stop
writing tests, and stop coding.

And if what we are doing isn't of benefit to the user, then shouldn't we be
asking ourselves why we're doing it?

# What else do we get from it?

BDD also lets us put the application requirements in code. See [Dan North][dnbdd]
for more on this one, but the TL;DR is that the thought process of
defining behaviors and codifying them parallels the requirements/analysis
process rather closely. Some folks have taken advantage of this to make their
written-down requirements be the high-level test code. Take a look at
[gherkin][gherkin] for how the language itself works, and [SpecFlow][specflow]
for how that might work in practice.

Some companies have even chosen to bind their tests to code structure via naming
schemes. By doing so, they have also chosen to add a requirement that whenever
code gets refactored, the tests need to be adjusted in order to match any
changes in method names and responsibilities. By focusing your test code on
behaviors instead of application structure, your code structure and method names
for the tests provide information that would otherwise be unavailable, while
also removing maintenance costs. Note that tooling must make it nail down where
exactly a test is in order for this approach to work. In C#, being able to map
a fully-qualified method name to a \*.cs file is probably enough to meet that
requirement (a helpful trick to be able to do regardless). In single-solution
C#, that isn't an issue. Multiple-solution C# is a different story.

# So how do people work with this in practice?

Well, you can always take the "literal" approach described by Dan North. Use
method names as sentences that describe the behavior being covered, and then
group methods into classes based on which behaviors describe the same thing.
This doesn't require a BDD framework at all, but does require discipline in
order to get all the benefits.

Some people find it beneficial to organize code a little more cleanly based on
which part of a behavior spec is getting tested.

## Code as a Gherkin translation layer

The folks behind [SpecFlow][specflow] have done a fantastic job enabling feature
files to be executable. The way they work, you write a feature file, generate a
class with step definitions, and then fill in each step definition. Doing things
this way gives you more space to write down user stories and elaborate on
Gherkin behaviors without C# code muddying what's going on. The C# is then
forced into smaller pieces that fit the Gherkin, rather than being allowed to
evolve/flow in whatever manner works best for the situation at hand. This
constraint on the C# can be both good and bad, depending on the details.

A spec file:

```
Feature: Calculator
       In order to avoid silly mistakes
       As a math idiot
       I want to be told the sum of two numbers

@mytag
Scenario: Add two numbers
       Given I have entered 50 into the calculator
       And I have also entered 70 into the calculator
       When I press add
       Then the result should be 120 on the screen
```

And the corresponding step definitions in C#:

``` csharp
using System;
using TechTalk.SpecFlow;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Example;

namespace MyProject.Specs
{
    [Binding]
    public class CalculatorSteps
    {
        private int result;
        private Calculator calculator = new Calculator();

        [Given(@"I have entered (.*) into the calculator")]
        public void GivenIHaveEnteredIntoTheCalculator(int number)
        {
            calculator.FirstNumber = number;
        }

        [Given(@"I have also entered (.*) into the calculator")]
        public void GivenIHaveAlsoEnteredIntoTheCalculator(int number)
        {
            calculator.SecondNumber = number;
        }

        [When(@"I press add")]
        public void WhenIPressAdd()
        {
            result = calculator.Add();
        }

        [Then(@"the result should be (.*) on the screen")]
        public void ThenTheResultShouldBeOnTheScreen(int expectedResult)
        {
            Assert.AreEqual(expectedResult, result);
        }
    }
}
```

SpecFlow uses the feature file as a base for code generation, kind of like T4
templates. The generated code invokes each step in order. The annotations appear
to tell the engine which methods to call for each step. Each class, then, is
limited to being just one scenario in the ideal case (I'm not going to describe
clever hacks on frameworks I haven't used extensively). My reading suggests that
placeholders (possibly regular rexpressions) are allowed in each step, allowing
some flexibility/re-use. Note that each step needs to have unique text for the
annotations.

## Code structured to read like Gherkin

[LightBDD][lbdd] doesn't allow quite as much space for user stories and
behaviors, but still recognizes them as important. While the isolation from
SpecFlow is still present, the feature files themselves are absent. User stories
are instead given as attributes, and the Gherkin is embedded in C# code. The end
result looks like the following, using partial classes to separate the spec-code
from the actual test-running code:

``` csharp
[FeatureDescription(
@"In order to access personal data
As an user
I want to login into system")] //feature description
[Label("Story-1")]
public partial class Login_feature //feature name
{
	[Scenario]
	[Label("Ticket-1")]
	public void Successful_login() //scenario name
	{
		Runner.RunScenario(

			Given_the_user_is_about_to_login, //steps
			Given_the_user_entered_valid_login,
			Given_the_user_entered_valid_password,
			When_the_user_clicks_login_button,
			Then_the_login_operation_should_be_successful,
			Then_a_welcome_message_containing_user_name_should_be_returned);
	}
}

[FeatureDescription(
@"In order to pay for products
As a customer
I want to receive invoice for bought items")] //feature description
[Label("Story-2")]
public partial class Invoice_feature //feature name
{
	[Scenario]
	[Label("Ticket-2")]
	public void Receiving_invoice_for_products() //scenario name
	{
		Runner.RunScenario(

			_ => Given_product_is_available_in_product_storage("wooden desk"), //steps
			_ => Given_product_is_available_in_product_storage("wooden shelf"),
			_ => When_customer_buys_product("wooden desk"),
			_ => When_customer_buys_product("wooden shelf"),
			_ => Then_an_invoice_should_be_sent_to_the_customer(),
			_ => Then_the_invoice_should_contain_product_with_price_of_AMOUNT("wooden desk", 62),
			_ => Then_the_invoice_should_contain_product_with_price_of_AMOUNT("wooden shelf", 37));
	}
}
```

``` csharp
public partial class Login_feature : FeatureFixture
{
	private const string _validUserName = "admin";
	private const string _validPassword = "password";

	private LoginRequest _loginRequest;
	private LoginService _loginService;
	private LoginResult _loginResult;

	private void Given_user_is_about_to_login()
	{
		_loginService = new LoginService();
		_loginService.AddUser(_validUserName, _validPassword);
		_loginRequest = new LoginRequest();
	}
	/* ... */
}

public partial class Invoice_feature : FeatureFixture
{
	private void Given_product_is_available_in_product_storage(string product) { /* ... */ }

	private void When_customer_buys_product(string product) { /* ... */ }

	private void Then_an_invoice_should_be_sent_to_the_customer() { /* ... */ }

	private void Then_the_invoice_should_contain_product_with_price_of_AMOUNT(string product, int amount)
	{ /* ... */ }
	/* ... */
}
```

Here, instead of relying on auto-generated code to control what's going on,
the feature itself is executable C# that controls the order of execution. This
setup is likely less readable for product folks, but works just fine for devs
(aside from having more ceremony than plain unit tests). While the assumption
here is once again one class per feature, I'm not sure how important to the
framework that limitation is.

## Gherkin optional

Lastly, it is very possible to read more free-form requirements from the code.
To enable this more thoroughly, there are libraries like [NSpec][nspc], which
make it easier to group code blocks, get method names into printed output, and
so on. From my view, the main goal with NSpec is not to codify requirements in a
common language, but to reinforce the behavior-driven philosophy that forms the
backbone of BDD.

An example is worth a lot of words:

``` csharp
using NSpec;
using FluentAssertions;

class my_first_spec : nspec
{
    string name;

    void before_each()
    {
        name = "NSpec";
    }

    void it_asserts_at_the_method_level()
    {
        name.ShouldBeEquivalentTo("NSpec");
    }

    void describe_nesting()
    {
        before = () => name += " Add Some Other Stuff";

        it["asserts in a method"] = () =>
        {
            name.ShouldBeEquivalentTo("NSpec Add Some Other Stuff");
        };

        context["more nesting"] = () =>
        {
            before = () => name += ", And Even More";

            it["also asserts in a lambda"] = () =>
            {
                name.ShouldBeEquivalentTo("NSpec Add Some Other Stuff, And Even More");
            };
        };
    }
}
```

When running the tests with NSpecRunner, this outputs:

```
my first spec
  asserts at the method level
  describe nesting
    asserts in a method
    more nesting
      also asserts in a lambda
```

With this, each test class should be a thing getting described, and each method
should likely be a behavior the thing can do, hence the special behavior with
"it_verbs" method names seen in the sample. The structure, though, is fairly
flexible, as long as reading the output makes sense to most people. Don't ask me
how it guarantees the method order, I can't figure it out.

## Driving without a harness

You can, of course, just use straight MSTest, or roll your own BDD adapter.
Depending on priorities or desired output formats, this can take any number of
turns, and creative API design is a useful trait here. [SaintGimp][sgbdd]
describes one approach involving a base class and careful output to Visual
Studio windows. [Kallanreed][krnc] chooses to focus on nested classes instead.
Taking this path is really about choosing to embrace having enough rope to hang
yourself with in order to get complete control over what standards you follow,
and using those standards to accomplish something useful that other libraries
and frameworks won't do for you.

# Things I did not address

This post is merely to help generate ideas. It does not provide recommendations,
and doesn't suggest what works well in a given environment. In particular, if
you have a particular test framework you want to continue using, or a particular
test runner you like, the libraries I've used for demonstration might not work
for you. Do your own research before choosing a tool.

[dnbdd]: https://dannorth.net/introducing-bdd/
[wpbdd]: https://en.wikipedia.org/wiki/Behavior-driven_development
[gherkin]: https://github.com/cucumber/cucumber/wiki/Gherkin
[lbdd]: https://github.com/LightBDD/LightBDD
[nspc]: http://nspec.org/
[specflow]: http://specflow.org/getting-started/
[sgbdd]: https://blogs.msdn.microsoft.com/elee/2009/01/20/bdd-with-mstest/
[krnc]: https://kallanreed.wordpress.com/2015/03/16/bdd-style-testing-with-mstest/
